# server/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from failedsummerizor.server.summarizer import summarize_text

app = Flask(__name__)
CORS(app)

@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.get_json()
    text = data.get("text", "")
    ratio = float(data.get("ratio", 0.3))
    language = data.get("language", "english")
    method = data.get("method", "textrank")  # or 'lsa', 'lexrank', etc.

    if not text.strip():
        return jsonify({"error": "Empty text"}), 400

    try:
        summary = summarize_text(text, method=method, ratio=ratio, language=language)
        return jsonify({"summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
