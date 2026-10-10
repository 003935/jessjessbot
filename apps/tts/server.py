from __future__ import annotations

import io
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import soundfile as sf
from kittenml import KittenTTS


HOST = "0.0.0.0"
PORT = 8080
MODEL_NAME = "KittenML/kitten-tts-2"
REFERENCE_FILE = Path(os.environ.get("KITTENTTS_REFERENCE_FILE", "/voice/reference.wav"))
MAX_REQUEST_BYTES = 8_192
MAX_TEXT_CHARS = 1_900
MAX_AUDIO_BYTES = 16 * 1024 * 1024

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("kittentts")

model: KittenTTS | None = None
model_lock = threading.Lock()
inference_lock = threading.Lock()


def get_model() -> KittenTTS:
    global model
    if not REFERENCE_FILE.is_file():
        raise FileNotFoundError("voice reference is not configured")
    reference_info = sf.info(str(REFERENCE_FILE))
    if reference_info.format != "WAV" or not 5 <= reference_info.duration <= 30:
        raise ValueError("voice reference must be a 5–30 second WAV file")
    with model_lock:
        if model is None:
            model = KittenTTS(MODEL_NAME)
    return model


class Handler(BaseHTTPRequestHandler):
    server_version = "JessJessBotTTS/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        # Do not log request bodies or URL query data.
        return

    def send_json(self, status: int, message: str) -> None:
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_json(404, "not found")
            return
        try:
            get_model()
        except FileNotFoundError:
            self.send_json(503, "voice reference is not ready")
            return
        except Exception as error:
            logger.warning("Model readiness failed (%s)", type(error).__name__)
            self.send_json(503, "speech model is not ready")
            return
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self.send_json(404, "not found")
            return
        raw_length = self.headers.get("Content-Length", "")
        try:
            length = int(raw_length)
        except ValueError:
            self.send_json(411, "content length is required")
            return
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self.send_json(413, "request body is too large or empty")
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, "content type must be application/json")
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, "invalid JSON")
            return
        text = payload.get("text") if isinstance(payload, dict) else None
        if not isinstance(text, str) or not text.strip():
            self.send_json(400, "text must be a non-empty string")
            return
        if len(text) > MAX_TEXT_CHARS:
            self.send_json(413, "text is too long")
            return

        try:
            tts = get_model()
            with inference_lock:
                audio = tts.generate(text.strip(), reference=str(REFERENCE_FILE))
            output = io.BytesIO()
            sf.write(output, audio, tts.sample_rate, format="WAV")
            wav = output.getvalue()
            if not wav.startswith(b"RIFF") or len(wav) > MAX_AUDIO_BYTES:
                self.send_json(502, "speech output was invalid or too large")
                return
        except FileNotFoundError:
            self.send_json(503, "voice reference is not ready")
            return
        except Exception as error:
            logger.warning("Speech generation failed (%s)", type(error).__name__)
            self.send_json(502, "speech generation failed")
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.end_headers()
        self.wfile.write(wav)


if __name__ == "__main__":
    if REFERENCE_FILE.is_file():
        try:
            get_model()
            logger.info("KittenTTS model is ready")
        except Exception as error:
            logger.warning("KittenTTS startup deferred (%s)", type(error).__name__)
    else:
        logger.warning("Voice reference is not configured; health is currently unavailable")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
