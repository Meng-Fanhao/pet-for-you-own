"""Text-to-speech synthesis and playback – pyttsx3 (offline) or edge-tts (online)."""

import io
import asyncio
import tempfile
from pathlib import Path
from utils import logger

# Lazy imports to avoid hard dependency errors
_pyttsx3_available = False
try:
    import pyttsx3
    _pyttsx3_available = True
except ImportError:
    pass

_edge_tts_available = False
try:
    import edge_tts
    _edge_tts_available = True
except ImportError:
    pass


def speak(text: str, engine: str = "edge-tts", voice: str | None = None):
    """Speak text aloud. 'engine' can be 'pyttsx3' (offline) or 'edge-tts' (higher quality)."""
    if not text.strip():
        return

    if engine == "edge-tts" and _edge_tts_available:
        _speak_edge_tts(text, voice)
    elif engine == "pyttsx3" and _pyttsx3_available:
        _speak_pyttsx3(text, voice)
    elif _pyttsx3_available:
        logger.warning("edge-tts not available, falling back to pyttsx3")
        _speak_pyttsx3(text, voice)
    elif _edge_tts_available:
        logger.warning("pyttsx3 not available, falling back to edge-tts")
        _speak_edge_tts(text, voice)
    else:
        logger.error("No TTS engine available. Install pyttsx3 or edge-tts.")


def _speak_pyttsx3(text: str, voice_hint: str | None = None):
    """pyttsx3 – offline TTS."""
    engine = pyttsx3.init()
    engine.setProperty("rate", 180)
    engine.setProperty("volume", 0.9)

    if voice_hint:
        voices = engine.getProperty("voices")
        for v in voices:
            if voice_hint.lower() in v.name.lower() or voice_hint in v.id:
                engine.setProperty("voice", v.id)
                break

    engine.say(text)
    engine.runAndWait()


def _speak_edge_tts(text: str, voice: str | None = None):
    """edge-tts – high quality TTS using Microsoft Edge's free TTS API."""
    voice = voice or "zh-CN-XiaoxiaoNeural"

    async def _run():
        communicate = edge_tts.Communicate(text, voice)
        # Stream to a temp MP3 and play with a system player, or use simpleaudio
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            await communicate.save(tmp.name)

        # Play the MP3
        _play_audio_file(tmp.name)
        Path(tmp.name).unlink(missing_ok=True)

    try:
        asyncio.run(_run())
    except Exception as e:
        logger.error("edge-tts playback failed: %s", e)


def _play_audio_file(filepath: str):
    """Cross-platform audio playback via system player."""
    import subprocess
    import sys

    fp = str(filepath)
    if sys.platform == "win32":
        subprocess.run(
            ["powershell", "-c",
             f'(New-Object Media.SoundPlayer "{fp}").PlaySync()'],
            capture_output=True,
        )
    elif sys.platform == "darwin":
        subprocess.run(["afplay", fp], capture_output=True)
    else:
        # Linux: try paplay, aplay, or ffplay
        for player in ["paplay", "aplay", "ffplay"]:
            if subprocess.run(["which", player], capture_output=True).returncode == 0:
                subprocess.run([player, fp], capture_output=True)
                return
        logger.warning("No audio player found on Linux")
