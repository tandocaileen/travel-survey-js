import json
import os
import datetime
from flask import Flask, request, jsonify, send_from_directory, abort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESPONSES_FILE = os.path.join(BASE_DIR, "responses.json")

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


# ── Responses graph page ──────────────────────────────────────────

@app.route("/responses-graph")
def responses_graph():
    if not os.path.exists(RESPONSES_FILE):
        responses = []
    else:
        try:
            with open(RESPONSES_FILE, "r", encoding="utf-8") as f:
                responses = json.load(f)
            if not isinstance(responses, list):
                responses = []
        except (json.JSONDecodeError, OSError):
            responses = []

    # Tally counts per question per answer
    tallies = {}  # { question: { answer: count } }
    names = []
    for entry in responses:
        name = entry.get("__name__", "Anonymous")
        names.append(name)
        for key, val in entry.items():
            if key.startswith("_") or key == "__name__":
                continue
            if key not in tallies:
                tallies[key] = {}
            # Values may be comma-separated (checkboxes)
            for part in val.split(", "):
                part = part.strip()
                if part:
                    tallies[key][part] = tallies[key].get(part, 0) + 1

    total = len(responses)

    # Build chart config objects for JSON embed
    charts = []
    COLORS = [
        "rgba(255,107,107,.8)", "rgba(255,217,61,.8)", "rgba(107,203,119,.8)",
        "rgba(116,192,252,.8)", "rgba(201,177,255,.8)", "rgba(255,159,100,.8)",
        "rgba(99,207,188,.8)",  "rgba(255,134,172,.8)",
    ]
    for question, counts in tallies.items():
        labels = list(counts.keys())
        data   = list(counts.values())
        colors = [COLORS[i % len(COLORS)] for i in range(len(labels))]
        charts.append({
            "question": question,
            "labels": labels,
            "data": data,
            "colors": colors,
        })

    charts_json = json.dumps(charts, ensure_ascii=False)
    names_json  = json.dumps(names, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>📊 Survey Responses</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
    :root{{--coral:#FF6B6B;--gold:#FFD93D;--cream:#FFF9F0;--text:#3D3535;--muted:#888080;--border:#EFE6DA;--radius:16px;--shadow:0 4px 20px rgba(0,0,0,.08)}}
    body{{font-family:'Nunito',sans-serif;background:var(--cream);color:var(--text);min-height:100vh;padding-bottom:60px}}
    header{{background:linear-gradient(135deg,#c0392b 0%,#e74c3c 40%,#f39c12 100%);color:#fff;text-align:center;padding:36px 20px 28px;position:relative}}
    header h1{{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;text-shadow:0 2px 8px rgba(0,0,0,.2)}}
    header p{{opacity:.85;margin-top:8px;font-size:.95rem}}
    .back-btn{{position:absolute;top:18px;left:18px;background:rgba(255,255,255,.2);border:none;color:#fff;padding:8px 14px;border-radius:20px;font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;text-decoration:none;transition:background .2s}}
    .back-btn:hover{{background:rgba(255,255,255,.35)}}
    .container{{max-width:900px;margin:0 auto;padding:28px 16px}}
    .summary{{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px}}
    .stat-card{{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:18px 24px;flex:1;min-width:160px;border-top:4px solid var(--gold)}}
    .stat-card .stat-num{{font-size:2rem;font-weight:900;color:var(--coral)}}
    .stat-card .stat-label{{font-size:.85rem;color:var(--muted);font-weight:600;margin-top:2px}}
    .respondents{{font-size:.85rem;color:var(--muted);margin-top:6px}}
    .chart-card{{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:24px;margin-bottom:24px}}
    .chart-card h2{{font-size:.95rem;font-weight:800;color:var(--text);margin-bottom:18px;line-height:1.4;padding-left:10px;border-left:4px solid var(--coral)}}
    .chart-wrap{{position:relative;max-height:320px}}
    .empty{{text-align:center;padding:60px 20px;color:var(--muted);font-size:1.1rem}}
  </style>
</head>
<body>
<header>
  <a class="back-btn" href="/">← Back to Survey</a>
  <h1>📊 Survey Responses</h1>
  <p>{total} response{"s" if total != 1 else ""} collected</p>
</header>
<div class="container">
  {"_EMPTY_" if total == 0 else "_CHARTS_"}
</div>
<script>
const charts = {charts_json};
const names  = {names_json};

if (names.length) {{
  const summary = document.querySelector('.container');

  // Stat cards
  const stats = document.createElement('div');
  stats.className = 'summary';
  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${{names.length}}</div>
      <div class="stat-label">Total Responses</div>
    </div>
    <div class="stat-card" style="border-top-color:#6BCB77">
      <div class="stat-num">${{charts.length}}</div>
      <div class="stat-label">Questions Answered</div>
    </div>
    <div class="stat-card" style="border-top-color:#74C0FC;flex:2">
      <div class="stat-label" style="margin-bottom:6px">Respondents</div>
      <div class="respondents">${{names.join(' · ')}}</div>
    </div>
  `;
  summary.prepend(stats);
}}

charts.forEach((c, idx) => {{
  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `<h2>${{c.question}}</h2><div class="chart-wrap"><canvas id="chart-${{idx}}"></canvas></div>`;
  document.querySelector('.container').appendChild(card);

  new Chart(document.getElementById('chart-' + idx), {{
    type: c.data.length > 6 ? 'bar' : 'bar',
    data: {{
      labels: c.labels,
      datasets: [{{
        data: c.data,
        backgroundColor: c.colors,
        borderRadius: 8,
        borderSkipped: false,
      }}]
    }},
    options: {{
      indexAxis: c.labels.length > 4 ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {{
        legend: {{ display: false }},
        tooltip: {{
          callbacks: {{
            label: ctx => ` ${{ctx.parsed.x ?? ctx.parsed.y}} vote${{(ctx.parsed.x ?? ctx.parsed.y) !== 1 ? 's' : ''}}`
          }}
        }}
      }},
      scales: {{
        x: {{ grid: {{ color: '#f5ede3' }}, ticks: {{ font: {{ family: 'Nunito', weight: '600' }} }} }},
        y: {{ grid: {{ color: '#f5ede3' }}, ticks: {{ font: {{ family: 'Nunito', weight: '600' }} }} }}
      }}
    }}
  }});
}});
</script>
</body>
</html>"""

    html = html.replace(
        "_EMPTY_",
        '<div class="empty">No responses yet. Share the survey link to collect answers! 🌏</div>'
    ).replace("_CHARTS_", "")

    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


if __name__ == "__main__":
    print("─" * 50)
    print("  Reusable survey server running at:")
    print("  http://localhost:8080")
    print("  Responses saved to: responses.json")
    print("─" * 50)
    app.run(host="0.0.0.0", port=8080, debug=True)
