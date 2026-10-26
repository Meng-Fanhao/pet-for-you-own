"""Utility functions: logging, WAV conversion, audio splitting."""

import io
import wave
import logging
import numpy as np
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

_log_start = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOG_DIR / f"voice_assistant_{_log_start}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("voice_assistant")


# ---------------------------------------------------------------------------
# Audio format conversion
# ---------------------------------------------------------------------------

def pcm_to_wav_bytes(pcm_data: np.ndarray, samplerate: int, channels: int = 1) -> bytes:
    """Convert float32 numpy array (-1..1) to WAV bytes (int16 PCM)."""
    int_data = (pcm_data.clip(-1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(samplerate)
        wf.writeframes(int_data.tobytes())
    return buf.getvalue()


def pcm_to_wav_file(pcm_data: np.ndarray, samplerate: int, filepath: str, channels: int = 1):
    """Save float32 numpy array as WAV file."""
    wav_bytes = pcm_to_wav_bytes(pcm_data, samplerate, channels)
    Path(filepath).write_bytes(wav_bytes)


def load_wav(filepath: str) -> tuple[np.ndarray, int]:
    """Load WAV file, return (float32 array, samplerate)."""
    with wave.open(filepath, "rb") as wf:
        samplerate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767.0
        return data, samplerate


def split_by_silence(
    audio: np.ndarray,
    samplerate: int,
    silence_threshold: float = 0.02,
    min_silence_duration: float = 0.5,
    min_segment_duration: float = 0.3,
) -> list[np.ndarray]:
    """Split audio on silence gaps. Returns list of segment arrays."""
    if len(audio) == 0:
        return []

    min_silence_samples = int(min_silence_duration * samplerate)
    min_segment_samples = int(min_segment_duration * samplerate)

    is_silent = np.abs(audio) < silence_threshold

    # Find boundaries
    segments = []
    pos = 0
    while pos < len(audio):
        # Skip silence
        while pos < len(audio) and is_silent[pos]:
            pos += 1
        if pos >= len(audio):
            break
        start = pos
        # Find end of speech
        silence_count = 0
        while pos < len(audio):
            if is_silent[pos]:
                silence_count += 1
                if silence_count >= min_silence_samples:
                    break
            else:
                silence_count = 0
            pos += 1
        end = pos - silence_count
        segment = audio[start:end]
        if len(segment) >= min_segment_samples:
            segments.append(segment)

    return segments


def ensure_dir(path: str | Path):
    Path(path).mkdir(parents=True, exist_ok=True)
