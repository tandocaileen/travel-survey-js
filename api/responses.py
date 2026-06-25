import json
import os
from http.server import BaseHTTPRequestHandler
from upstash_redis import Redis

KV_KEY = "survey_responses"


def _redis():
    return Redis(
        url=os.environ["KV_REST_API_URL"],
        token=os.environ["KV_REST_API_TOKEN"],
    )


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        try:
            r = _redis()
            raw = r.lrange(KV_KEY, 0, -1)  # all entries
            responses = [json.loads(item) if isinstance(item, str) else item for item in raw]
            payload = json.dumps(responses, ensure_ascii=False).encode()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        except Exception as e:
            err = json.dumps({"error": str(e)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)
