// ── State ──────────────────────────────────────────────────────────────────
let currentView = 'active';  // which tab is open
let currentTasks = [];

// ── Start everything when the page loads ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  loadStats();
  bindUI();
});

// ── Wire up all the buttons and inputs ────────────────────────────────────
function bindUI() {
  // Sidebar nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      const titles = { active: 'Active Tasks', completed: 'Completed', archive: 'Archive' };
      document.getElementById('view-title').textContent = titles[currentView];
      loadTasks();
    });
  });

  // Open/close the add-task modal
  document.getElementById('open-add').addEventListener('click', () =>
    document.getElementById('modal-overlay').classList.remove('hidden'));
  document.getElementById('close-modal').addEventListener('click', () =>
    document.getElementById('modal-overlay').classList.add('hidden'));
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget)
      document.getElementById('modal-overlay').classList.add('hidden');
  });

  document.getElementById('save-task').addEventListener('click', saveTask);

  // Query bar — Ask button and Enter key
  document.getElementById('run-query').addEventListener('click', runQuery);
  document.getElementById('query-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runQuery();
  });

  // Quick chip shortcuts
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('query-input').value = chip.dataset.q;
      runQuery();
    });
  });
}

// ── API helper — talks to the Python server ───────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return res.json();
}

// ── Load tasks from the server and show them ──────────────────────────────
async function loadTasks() {
  let tasks;
  if (currentView === 'active') {
    tasks = await api('/api/tasks');
    currentTasks = tasks.filter(t => !t.completed && !t.archived);
  } else if (currentView === 'completed') {
    tasks = await api('/api/tasks?archived=1');
    currentTasks = tasks.filter(t => t.completed);
  } else {
    tasks = await api('/api/tasks?archived=1');
    currentTasks = tasks.filter(t => t.archived && !t.completed);
  }
  renderTasks(currentTasks);
  hideSummary();
}

// ── Load the sidebar stats numbers ────────────────────────────────────────
async function loadStats() {
  const s = await api('/api/stats');
  document.getElementById('s-overdue').textContent = s.overdue;
  document.getElementById('s-today').textContent   = s.due_today;
  document.getElementById('s-week').textContent    = s.this_week;
  document.getElementById('s-done').textContent    = s.completed;
}

// ── Save a new task ───────────────────────────────────────────────────────
async function saveTask() {
  const name  = document.getElementById('f-name').value.trim();
  const date  = document.getElementById('f-date').value;
  const cat   = document.getElementById('f-cat').value;
  const notes = document.getElementById('f-notes').value.trim();
  if (!name || !date) return;
  await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ name, due_date: date, category: cat, notes })
  });
  document.getElementById('f-name').value = '';
  document.getElementById('f-notes').value = '';
  document.getElementById('modal-overlay').classList.add('hidden');
  await loadTasks();
  await loadStats();
}

// ── Mark a task done ──────────────────────────────────────────────────────
async function completeTask(id) {
  await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed: 1 }) });
  await loadTasks();
  await loadStats();
}

// ── Archive a task (hides it but keeps history) ───────────────────────────
async function archiveTask(id) {
  await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: 1 }) });
  await loadTasks();
  await loadStats();
}

// ── Permanently delete a task ─────────────────────────────────────────────
async function deleteTask(id) {
  if (!confirm('Delete this task permanently?')) return;
  await api(`/api/tasks/${id}`, { method: 'DELETE' });
  await loadTasks();
  await loadStats();
}

// ── Run a natural language query ──────────────────────────────────────────
async function runQuery() {
  const q = document.getElementById('query-input').value.trim();
  if (!q) return;
  const result = await api('/api/query', { method: 'POST', body: JSON.stringify({ q }) });
  currentTasks = result.tasks;
  renderTasks(currentTasks);
  showSummary(result.summary);
}

// ── Build the HTML for one task card ─────────────────────────────────────
function taskCard(t) {
  const u = t.urgency;
  const badgeClass = {
    overdue: 'badge-overdue', today: 'badge-today',
    soon: 'badge-soon', future: 'badge-future', done: 'badge-done'
  }[u.level] || 'badge-future';

  const notes = t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : '';

  const archiveBtn = !t.archived && !t.completed
    ? `<button class="btn-icon archive-btn" title="Archive" onclick="archiveTask(${t.id})">🗂</button>`
    : '';
  const completeBtn = !t.completed
    ? `<button class="btn-icon complete-btn" title="Mark complete" onclick="completeTask(${t.id})">✓</button>`
    : '';

  return `
    <div class="task-card level-${u.level}">
      <div>
        <div class="task-name">${esc(t.name)}</div>
        <div class="task-meta">
          <span class="task-date">${t.due_date}</span>
          <span class="task-cat">${esc(t.category)}</span>
          <span class="urgency-badge ${badgeClass}">${u.label}</span>
        </div>
        ${notes}
      </div>
      <div class="task-actions">
        ${completeBtn}
        ${archiveBtn}
        <button class="btn-icon delete-btn" title="Delete" onclick="deleteTask(${t.id})">✕</button>
      </div>
    </div>`;
}

// ── Render a list of tasks into the page ─────────────────────────────────
function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">No tasks found.</div>';
    return;
  }
  list.innerHTML = tasks.map(taskCard).join('');
}

function showSummary(text) {
  const bar = document.getElementById('summary-bar');
  bar.textContent = text;
  bar.classList.remove('hidden');
}
function hideSummary() {
  document.getElementById('summary-bar').classList.add('hidden');
}

// safely escape text so it can't break the HTML
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}