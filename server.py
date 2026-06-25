import json
import os
import datetime
from flask import Flask, request, jsonify, send_from_directory, abort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# On Render, set RESPONSES_DIR env var to the mounted disk path (e.g. /data).
# Falls back to the project directory for local use.
_responses_dir = os.environ.get("RESPONSES_DIR", BASE_DIR)
RESPONSES_FILE = os.path.join(_responses_dir, "responses.json")

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")


#Static assets
@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/survey.md")
def survey_md():
    return send_from_directory(BASE_DIR, "survey.md")


@app.route("/css/<path:filename>")
def css(filename):
    return send_from_directory(os.path.join(BASE_DIR, "css"), filename)


@app.route("/js/<path:filename>")
def js(filename):
    return send_from_directory(os.path.join(BASE_DIR, "js"), filename)


#submit endpoint
@app.route("/submit", methods=["POST"])
def submit():
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        abort(400, description="Invalid JSON payload")

    # Sanitize: limit key/value lengths to prevent abuse
    MAX_KEYS = 200
    MAX_VALUE_LEN = 5000
    if len(data) > MAX_KEYS:
        abort(400, description="Too many fields")

    sanitized = {}
    for k, v in data.items():
        sanitized[str(k)[:300]] = str(v)[:MAX_VALUE_LEN] if v is not None else ""

    sanitized["_submitted_at"] = datetime.datetime.now().isoformat()

    # Load existing responses
    responses = []
    if os.path.exists(RESPONSES_FILE):
        try:
            with open(RESPONSES_FILE, "r", encoding="utf-8") as f:
                responses = json.load(f)
            if not isinstance(responses, list):
                responses = []
        except (json.JSONDecodeError, OSError):
            responses = []

    responses.append(sanitized)

    with open(RESPONSES_FILE, "w", encoding="utf-8") as f:
        json.dump(responses, f, indent=2, ensure_ascii=False)

    return jsonify({"status": "ok", "total": len(responses)})


#view responses endpoint
@app.route("/responses")
def view_responses():
    if not os.path.exists(RESPONSES_FILE):
        return jsonify([])
    with open(RESPONSES_FILE, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


# Responses graph page

@app.route("/responses-graph")
def responses_graph():
    return send_from_directory(BASE_DIR, "responses-graph.html")



if __name__ == "__main__":
    print("─" * 50)
    print("  Reusable survey server running at:")
    print("  http://localhost:8080")
    print("  Responses saved to: responses.json")
    print("─" * 50)
    app.run(host="0.0.0.0", port=8080, debug=True)
