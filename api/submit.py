import json
import os
import datetime
from http.server import BaseHTTPRequestHandler
from upstash_redis import Redis

KV_KEY = "survey_responses"


def _redis():
    return Redis(
        url=os.environ["KV_REST_API_URL"],
        token=os.environ["KV_REST_API_TOKEN"],
    )


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            if not isinstance(data, dict):
                self._respond(400, {"error": "Invalid payload"})
                return

            # Sanitize
            MAX_KEYS, MAX_VAL = 200, 5000
            if len(data) > MAX_KEYS:
                self._respond(400, {"error": "Too many fields"})
                return

            sanitized = {str(k)[:300]: str(v)[:MAX_VAL] for k, v in data.items() if v is not None}
            sanitized["_submitted_at"] = datetime.datetime.utcnow().isoformat() + "Z"

            # Append to Redis list
            r = _redis()
            r.rpush(KV_KEY, json.dumps(sanitized, ensure_ascii=False))
            total = r.llen(KV_KEY)

            self._respond(200, {"status": "ok", "total": total})

        except Exception as e:
            self._respond(500, {"error": str(e)})

    def do_OPTIONS(self):
        self._cors_headers()
        self.send_response(204)
        self.end_headers()

    def _respond(self, status, body):
        payload = json.dumps(body).encode()
        self._cors_headers()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
