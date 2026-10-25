from __future__ import annotations

import io
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import soundfile as sf
import torch
import torchaudio.functional as audio_functional
import whisper
from omnivoice import OmniVoice, VoiceClonePrompt


HOST = "0.0.0.0"
PORT = 8080
MODEL_NAME = "k2-fsa/OmniVoice"
REFERENCE_FILE = Path(os.environ.get("OMNIVOICE_REFERENCE_FILE", "/voice/reference.wav"))
REFERENCE_TEXT = os.environ.get("OMNIVOICE_REFERENCE_TEXT", "").strip()
VOICE_PROMPT_FILE = Path(
    os.environ.get("OMNIVOICE_VOICE_PROMPT_FILE", "/cache/voice-clone-prompt.pt")
)
SAMPLE_RATE = 24_000
MAX_REQUEST_BYTES = 8_192
MAX_TEXT_CHARS = 1_900
MAX_AUDIO_BYTES = 16 * 1024 * 1024
MAX_TRANSCRIBE_BYTES = 2 * 1024 * 1024
TRANSCRIBE_SAMPLE_RATE = 48_000
TRANSCRIBE_MAX_SECONDS = 15
WHISPER_MODEL_NAME = "small.en"
WHISPER_CACHE = Path("/cache/whisper")
# Socket timeout for slow or stalled clients (applies to socket reads/writes, not inference).
REQUEST_TIMEOUT_SECONDS = 30
# POST requests beyond this many in flight are rejected with 503 instead of piling up threads.
MAX_CONCURRENT_REQUESTS = max(1, int(os.environ.get("OMNIVOICE_MAX_CONCURRENT_REQUESTS", "4")))
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("omnivoice")

model: OmniVoice | None = None
voice_clone_prompt: VoiceClonePrompt | None = None
whisper_model: whisper.Whisper | None = None
whisper_lock = threading.Lock()
inference_lock = threading.Lock()
request_slots = threading.BoundedSemaphore(MAX_CONCURRENT_REQUESTS)
# Set once the background loader has finished, successfully or not.
model_loaded = threading.Event()
# Cached load failure so neither requests nor /health ever retry the load.
model_error: BaseException | None = None


class ModelNotReady(RuntimeError):
    pass


def load_model() -> None:
    """Load OmniVoice once. Runs in a background thread started at startup."""
    global model, voice_clone_prompt, model_error
    try:
        if not REFERENCE_FILE.is_file():
            raise FileNotFoundError("voice reference is not configured")
        reference_info = sf.info(str(REFERENCE_FILE))
        if reference_info.format != "WAV" or not 3 <= reference_info.duration <= 30:
            raise ValueError("voice reference must be a 3–30 second WAV file")
        loaded_model = OmniVoice.from_pretrained(
            MODEL_NAME,
            device_map="cuda:0",
            dtype=torch.float16,
        )
        if VOICE_PROMPT_FILE.is_file():
            loaded_prompt = VoiceClonePrompt.load(str(VOICE_PROMPT_FILE))
        else:
            VOICE_PROMPT_FILE.parent.mkdir(parents=True, exist_ok=True)
            loaded_prompt = loaded_model.create_voice_clone_prompt(
                ref_audio=str(REFERENCE_FILE),
                ref_text=REFERENCE_TEXT or None,
            )
            loaded_prompt.save(str(VOICE_PROMPT_FILE))
        model = loaded_model
        voice_clone_prompt = loaded_prompt
        logger.info("OmniVoice model and cloned voice prompt are ready on the NVIDIA GPU")
    except Exception as error:
        model_error = error
        if isinstance(error, FileNotFoundError):
            logger.warning("Voice reference is not configured; speech is unavailable")
        else:
            logger.warning("OmniVoice startup failed (%s)", type(error).__name__)
    finally:
        model_loaded.set()
    if model is not None:
        # Warm Whisper so the first transcription is not slow. A failure here is
        # not cached: get_whisper_model() retries lazily on the next request.
        try:
            get_whisper_model()
        except Exception as error:
            logger.warning("Whisper warm-up failed (%s)", type(error).__name__)


def get_model() -> tuple[OmniVoice, VoiceClonePrompt]:
    """Return the loaded model. Never triggers a load."""
    if not model_loaded.is_set():
        raise ModelNotReady("speech model is still loading")
    if model_error is not None:
        raise model_error
    if model is None or voice_clone_prompt is None:
        raise RuntimeError("OmniVoice was not initialized")
    return model, voice_clone_prompt


def get_whisper_model() -> whisper.Whisper:
    global whisper_model
    if not torch.cuda.is_available():
        raise RuntimeError("NVIDIA GPU is unavailable")
    with whisper_lock:
        if whisper_model is None:
            WHISPER_CACHE.mkdir(parents=True, exist_ok=True)
            whisper_model = whisper.load_model(
                WHISPER_MODEL_NAME,
                device="cuda:0",
                download_root=str(WHISPER_CACHE),
            )
            logger.info("Whisper transcription model is ready on the NVIDIA GPU")
    return whisper_model


class Handler(BaseHTTPRequestHandler):
    server_version = "JessJessBotTTS/1.0"
    timeout = REQUEST_TIMEOUT_SECONDS

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
        # Reports the background loader's state; never triggers a load.
        try:
            get_model()
        except FileNotFoundError:
            self.send_json(503, "voice reference is not ready")
            return
        except Exception:
            self.send_json(503, "speech model is not ready")
            return
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path not in ("/synthesize", "/transcribe"):
            self.send_json(404, "not found")
            return
        if not request_slots.acquire(blocking=False):
            self.send_json(503, "speech service is busy")
            return
        try:
            if self.path == "/transcribe":
                self.do_transcribe()
            else:
                self.do_synthesize()
        finally:
            request_slots.release()

    def do_synthesize(self) -> None:
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
            tts, clone_prompt = get_model()
        except FileNotFoundError:
            self.send_json(503, "voice reference is not ready")
            return
        except Exception:
            self.send_json(503, "speech model is not ready")
            return
        try:
            # Serialize TTS with ASR, but bound how long requests may wait.
            if not inference_lock.acquire(timeout=60):
                self.send_json(503, "speech service is busy")
                return
            try:
                audio_segments = tts.generate(
                    text=text.strip(),
                    voice_clone_prompt=clone_prompt,
                    num_step=16,
                    speed=1.0,
                    postprocess_output=True,
                )
                if not audio_segments:
                    raise ValueError("OmniVoice returned no audio")
                audio = audio_segments[0]
            finally:
                inference_lock.release()
            output = io.BytesIO()
            sf.write(output, audio, SAMPLE_RATE, format="WAV")
            wav = output.getvalue()
            if not wav.startswith(b"RIFF") or len(wav) > MAX_AUDIO_BYTES:
                self.send_json(502, "speech output was invalid or too large")
                return
        except Exception as error:
            logger.warning("OmniVoice generation failed (%s)", type(error).__name__)
            self.send_json(502, "speech generation failed")
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.end_headers()
        self.wfile.write(wav)

    def do_transcribe(self) -> None:
        raw_length = self.headers.get("Content-Length", "")
        try:
            length = int(raw_length)
        except ValueError:
            self.send_json(411, "content length is required")
            return
        max_bytes = TRANSCRIBE_SAMPLE_RATE * TRANSCRIBE_MAX_SECONDS * 2
        if length <= 0 or length > min(MAX_TRANSCRIBE_BYTES, max_bytes):
            self.send_json(413, "audio is too large or empty")
            return
        if self.headers.get_content_type() != "application/octet-stream":
            self.send_json(415, "content type must be application/octet-stream")
            return
        pcm = self.rfile.read(length)
        if len(pcm) != length or length % 2:
            self.send_json(400, "audio must be mono signed 16-bit PCM")
            return
        if not torch.cuda.is_available():
            self.send_json(503, "NVIDIA GPU is unavailable")
            return
        samples = torch.frombuffer(bytearray(pcm), dtype=torch.int16).to(torch.float32)
        waveform = samples.div_(32768.0)
        if waveform.numel() == 0 or float(torch.sqrt(torch.mean(waveform.square()))) < 0.008:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", "11")
            self.end_headers()
            self.wfile.write(b'{"text":""}')
            return
        try:
            waveform = audio_functional.resample(waveform, TRANSCRIBE_SAMPLE_RATE, 16_000)
            recognition_model = get_whisper_model()
            if not inference_lock.acquire(timeout=60):
                self.send_json(503, "speech service is busy")
                return
            try:
                result = recognition_model.transcribe(
                    waveform.cpu().numpy(),
                    language="en",
                    fp16=True,
                    verbose=False,
                )
            finally:
                inference_lock.release()
            text = result.get("text", "").strip()[:1_900]
            body = json.dumps({"text": text}).encode("utf-8")
        except Exception as error:
            logger.warning("Whisper transcription failed (%s)", type(error).__name__)
            self.send_json(502, "speech transcription failed")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    # Load the model once in the background so /health answers immediately.
    threading.Thread(target=load_model, name="model-loader", daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
