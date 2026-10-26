"""Speech-to-text via local Whisper model."""

import numpy as np
import whisper
from pathlib import Path
from utils import logger, pcm_to_wav_bytes, ensure_dir

# Cache dir for Whisper models
WHISPER_CACHE = Path(__file__).resolve().parent / "whisper_models"
ensure_dir(WHISPER_CACHE)


class Transcriber:
    """Loads Whisper locally and transcribes audio chunks."""

    def __init__(self, model_name: str = "base", language: str | None = None):
        self.model_name = model_name
        self.language = language
        self._model: whisper.Whisper | None = None

        logger.info("Transcriber configured: model=%s, lang=%s", model_name, language or "auto")

    @property
    def model(self) -> whisper.Whisper:
        """Lazy-load the Whisper model (downloaded on first use)."""
        if self._model is None:
            logger.info("Loading Whisper model '%s' (this may take a moment)...", self.model_name)
            # whisper downloads models to ~/.cache/whisper by default
            self._model = whisper.load_model(self.model_name, download_root=str(WHISPER_CACHE))
            logger.info("Whisper model '%s' loaded", self.model_name)
        return self._model

    def transcribe(self, audio: np.ndarray, samplerate: int = 16000) -> str:
        """Transcribe float32 audio array to text. Returns empty string if no speech."""
        if len(audio) == 0 or np.max(np.abs(audio)) < 0.005:
            return ""

        # Convert to a temporary WAV file path (whisper needs file input)
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        try:
            wav_bytes = pcm_to_wav_bytes(audio, samplerate)
            tmp.write(wav_bytes)
            tmp.close()

            options = {}
            if self.language:
                options["language"] = self.language

            result = self.model.transcribe(
                tmp.name,
                fp16=False,
                **options,
            )
            text = result["text"].strip()
            if text:
                logger.info("Transcribed: %s", text)
            return text
        finally:
            Path(tmp.name).unlink(missing_ok=True)

    def transcribe_chunks(self, chunks: list[np.ndarray], samplerate: int = 16000) -> list[str]:
        """Transcribe multiple audio chunks. Filters out empty results."""
        results = []
        for chunk in chunks:
            text = self.transcribe(chunk, samplerate)
            if text:
                results.append(text)
        return results
