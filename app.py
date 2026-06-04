"""
Due Date Tracker — Flask backend
Language: Python
Database: SQLite (via Python's built-in sqlite3)
"""

import sqlite3
import os
from datetime import date, timedelta
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "tasks.db")


# connects to the SQLite database file
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# creates the two tables on first run
def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                due_date    TEXT    NOT NULL,
                category    TEXT    DEFAULT 'general',
                notes       TEXT    DEFAULT '',
                completed   INTEGER DEFAULT 0,
                archived    INTEGER DEFAULT 0,
                created_at  TEXT    DEFAULT (date('now')),
                updated_at  TEXT    DEFAULT (date('now'))
            );

            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id     INTEGER NOT NULL,
                event       TEXT    NOT NULL,
                happened_at TEXT    DEFAULT (datetime('now')),
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );
        """)


# turns plain English into SQL — "overdue", "this week", "most urgent", etc.
def parse_natural_query(q):
    q_lower = q.strip().lower()
    today = date.today().isoformat()
    week_end = (date.today() + timedelta(days=7)).isoformat()
    month_end = (date.today() + timedelta(days=30)).isoformat()
    month_ago = (date.today() - timedelta(days=30)).isoformat()

    base = "SELECT * FROM tasks WHERE archived = 0"

    if any(w in q_lower for w in ["overdue", "late", "past", "missed"]):
        return dict(sql=f"{base} AND completed=0 AND due_date < ? ORDER BY due_date ASC",
                    params=[today], label="overdue tasks", limit=None)

    if any(w in q_lower for w in ["today", "right now"]):
        return dict(sql=f"{base} AND completed=0 AND due_date = ? ORDER BY name ASC",
                    params=[today], label="tasks due today", limit=None)

    if "this week" in q_lower or "next 7" in q_lower:
        return dict(sql=f"{base} AND completed=0 AND due_date BETWEEN ? AND ? ORDER BY due_date ASC",
                    params=[today, week_end], label="tasks due this week", limit=None)

    if any(w in q_lower for w in ["urgent", "pressing", "critical", "most important", "top"]):
        return dict(sql=f"{base} AND completed=0 ORDER BY due_date ASC",
                    params=[], label="most urgent tasks", limit=5)

    if any(w in q_lower for w in ["done", "complete", "finished"]):
        return dict(sql="SELECT * FROM tasks WHERE completed=1 ORDER BY updated_at DESC",
                    params=[], label="completed tasks", limit=None)

    if any(w in q_lower for w in ["archive", "old", "past month", "last month"]):
        return dict(sql=f"SELECT * FROM tasks WHERE created_at >= ? ORDER BY due_date ASC",
                    params=[month_ago], label="tasks from the last 30 days", limit=None)

    if any(w in q_lower for w in ["next month", "30 days", "month"]):
        return dict(sql=f"{base} AND completed=0 AND due_date BETWEEN ? AND ? ORDER BY due_date ASC",
                    params=[today, month_end], label="tasks due in the next 30 days", limit=None)

    if any(w in q_lower for w in ["all", "everything", "list"]):
        return dict(sql=f"{base} ORDER BY due_date ASC",
                    params=[], label="all active tasks", limit=None)

    # default fallback
    return dict(sql=f"{base} AND completed=0 AND due_date >= ? ORDER BY due_date ASC",
                params=[today], label="upcoming tasks", limit=None)


# figures out how urgent a task is based on today's real date
def urgency_score(due_date_str, completed):
    if completed:
        return {"level": "done", "label": "done", "days": None}
    today = date.today()
    due = date.fromisoformat(due_date_str)
    diff = (due - today).days
    if diff < 0:
        return {"level": "overdue", "label": f"{abs(diff)}d overdue", "days": diff}
    if diff == 0:
        return {"level": "today", "label": "due today", "days": 0}
    if diff <= 7:
        return {"level": "soon", "label": f"in {diff}d", "days": diff}
    return {"level": "future", "label": f"in {diff}d", "days": diff}


def row_to_dict(row):
    d = dict(row)
    d["urgency"] = urgency_score(d["due_date"], d["completed"])
    return d


# ── Routes (URL endpoints) ────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", today=date.today().isoformat())

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    show_archived = request.args.get("archived", "0") == "1"
    with get_db() as conn:
        if show_archived:
            rows = conn.execute("SELECT * FROM tasks ORDER BY due_date ASC").fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks WHERE archived=0 ORDER BY due_date ASC").fetchall()
    tasks = [row_to_dict(r) for r in rows]
    tasks.sort(key=lambda t: (t["urgency"]["days"] is None, t["urgency"]["days"] or 9999))
    return jsonify(tasks)

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.json
    name = (data.get("name") or "").strip()
    due_date = (data.get("due_date") or "").strip()
    category = (data.get("category") or "general").strip()
    notes = (data.get("notes") or "").strip()
    if not name or not due_date:
        return jsonify({"error": "name and due_date are required"}), 400
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO tasks (name, due_date, category, notes) VALUES (?, ?, ?, ?)",
            [name, due_date, category, notes]
        )
        task_id = cur.lastrowid
        conn.execute("INSERT INTO history (task_id, event) VALUES (?, ?)", [task_id, "created"])
        row = conn.execute("SELECT * FROM tasks WHERE id=?", [task_id]).fetchone()
    return jsonify(row_to_dict(row)), 201

@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.json
    allowed = {"name", "due_date", "category", "notes", "completed", "archived"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "nothing to update"}), 400
    updates["updated_at"] = date.today().isoformat()
    set_clause = ", ".join(f"{k}=?" for k in updates)
    vals = list(updates.values()) + [task_id]
    with get_db() as conn:
        conn.execute(f"UPDATE tasks SET {set_clause} WHERE id=?", vals)
        event = next((k for k in ("completed", "archived") if k in updates), "updated")
        conn.execute("INSERT INTO history (task_id, event) VALUES (?, ?)", [task_id, event])
        row = conn.execute("SELECT * FROM tasks WHERE id=?", [task_id]).fetchone()
    return jsonify(row_to_dict(row))

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as conn:
        conn.execute("DELETE FROM history WHERE task_id=?", [task_id])
        conn.execute("DELETE FROM tasks WHERE id=?", [task_id])
    return jsonify({"deleted": task_id})

@app.route("/api/query", methods=["POST"])
def natural_query():
    q = (request.json or {}).get("q", "").strip()
    if not q:
        return jsonify({"error": "query required"}), 400
    parsed = parse_natural_query(q)
    with get_db() as conn:
        rows = conn.execute(parsed["sql"], parsed["params"]).fetchall()
    tasks = [row_to_dict(r) for r in rows]
    if parsed["limit"]:
        tasks = tasks[:parsed["limit"]]
    tasks.sort(key=lambda t: (t["urgency"]["days"] is None, t["urgency"]["days"] or 9999))
    today = date.today().isoformat()
    overdue = [t for t in tasks if t["due_date"] < today and not t["completed"]]
    due_today = [t for t in tasks if t["due_date"] == today and not t["completed"]]
    soon = [t for t in tasks if 0 < (t["urgency"]["days"] or 999) <= 7]
    summary = f"Found {len(tasks)} {parsed['label']}."
    if overdue:
        summary += f" {len(overdue)} overdue."
    if due_today:
        summary += f" {len(due_today)} due today."
    if soon:
        summary += f" {len(soon)} due within 7 days."
    if tasks:
        top = tasks[0]
        summary += f" Most pressing: {top['name']} ({top['due_date']})."
    return jsonify({"tasks": tasks, "label": parsed["label"], "summary": summary})

@app.route("/api/stats", methods=["GET"])
def stats():
    today = date.today().isoformat()
    week_end = (date.today() + timedelta(days=7)).isoformat()
    with get_db() as conn:
        total    = conn.execute("SELECT COUNT(*) FROM tasks WHERE archived=0").fetchone()[0]
        overdue  = conn.execute("SELECT COUNT(*) FROM tasks WHERE archived=0 AND completed=0 AND due_date<?", [today]).fetchone()[0]
        due_today = conn.execute("SELECT COUNT(*) FROM tasks WHERE archived=0 AND completed=0 AND due_date=?", [today]).fetchone()[0]
        this_week = conn.execute("SELECT COUNT(*) FROM tasks WHERE archived=0 AND completed=0 AND due_date BETWEEN ? AND ?", [today, week_end]).fetchone()[0]
        completed = conn.execute("SELECT COUNT(*) FROM tasks WHERE completed=1").fetchone()[0]
    return jsonify({"total": total, "overdue": overdue,
                    "due_today": due_today, "this_week": this_week, "completed": completed})


if __name__ == "__main__":
    init_db()
    print("Starting Due Date Tracker on http://localhost:5000")
    app.run(debug=True, port=5000)