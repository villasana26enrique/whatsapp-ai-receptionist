"""Audio converter for n8n: raw PCM (base64, as returned by Gemini TTS) -> OGG/Opus (WhatsApp voice note).

POST /pcm-to-ogg  JSON {"audio_base64": "...", "sample_rate": 24000}  -> audio/ogg
GET  /health                                                         -> ok
"""
import base64
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 20 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, b"ok", "text/plain")
        else:
            self._respond(404, b"not found", "text/plain")

    def do_POST(self):
        if self.path != "/pcm-to-ogg":
            return self._respond(404, b"not found", "text/plain")

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BYTES:
            return self._error(413, "Empty or too large body")

        try:
            payload = json.loads(self.rfile.read(length))
            pcm = base64.b64decode(payload["audio_base64"])
            sample_rate = int(payload.get("sample_rate", 24000))
        except (ValueError, KeyError) as e:
            return self._error(400, f"Invalid JSON: {e}")

        # 16-bit mono PCM -> Opus in an OGG container at 48 kHz (what WhatsApp uses for voice notes)
        result = subprocess.run(
            ["ffmpeg", "-loglevel", "error",
             "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
             "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-f", "ogg", "pipe:1"],
            input=pcm, capture_output=True, timeout=60)
        if result.returncode != 0:
            return self._error(500, result.stderr.decode(errors="replace")[:500])

        self._respond(200, result.stdout, "audio/ogg")

    def _error(self, status, message):
        self._respond(status, json.dumps({"error": message}).encode(), "application/json")

    def _respond(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
