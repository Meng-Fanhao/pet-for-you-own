#!/usr/bin/env python3
"""
Voice Assistant – Main entry point.
Supports DeepSeek and Coze AI providers.

Flow:
  1. Check virtual audio device
  2. Backup current audio device
  3. Switch to virtual device as default
  4. Loop: capture audio → Whisper STT → AI Chat → TTS
  5. On exit: restore original audio device
"""

import sys
import signal
import yaml
from pathlib import Path

from utils import logger
from device_switcher import (
    check_virtual_device,
    backup_current_device,
    set_virtual_as_default,
    restore_original,
)
from audio_capture import AudioRecorder
from transcriber import Transcriber
from tts_player import speak

# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------
CONFIG_DIR = Path(__file__).resolve().parent


def load_config() -> dict:
    local = CONFIG_DIR / "config.local.yaml"
    default = CONFIG_DIR / "config.yaml"

    cfg = {}
    if default.exists():
        with open(default) as f:
            cfg = yaml.safe_load(f) or {}

    if local.exists():
        with open(local) as f:
            override = yaml.safe_load(f) or {}
        cfg.update(override)

    return cfg


# ---------------------------------------------------------------------------
# AI Client factory
# ---------------------------------------------------------------------------
def create_client(cfg: dict):
    """Create AI client based on provider setting."""
    provider = cfg.get("provider", "deepseek").lower()

    if provider == "coze":
        from coze_client import CozeClient
        coze_cfg = cfg.get("coze", {})
        pat = coze_cfg.get("pat", "")
        bot_id = coze_cfg.get("bot_id", "")
        if not pat or not bot_id:
            print("ERROR: Coze PAT and Bot ID required in config.local.yaml")
            sys.exit(1)
        logger.info("Using Coze API (bot: %s)", bot_id)
        return CozeClient(
            pat=pat,
            bot_id=bot_id,
            base_url=coze_cfg.get("base_url", "https://api.coze.cn/v3"),
            user_id=coze_cfg.get("user_id", "desktop_pet_user"),
        ), "remote"  # Coze manages its own history

    else:  # deepseek
        from deepseek_client import DeepSeekClient
        ds_cfg = cfg.get("deepseek", {})
        api_key = ds_cfg.get("api_key", "")
        if not api_key:
            print("ERROR: DeepSeek API key required in config.local.yaml")
            sys.exit(1)
        logger.info("Using DeepSeek API (model: %s)", ds_cfg.get("model", "deepseek-chat"))
        return DeepSeekClient(
            api_key=api_key,
            base_url=ds_cfg.get("base_url", "https://api.deepseek.com/v1"),
            model=ds_cfg.get("model", "deepseek-chat"),
            max_tokens=ds_cfg.get("max_tokens", 150),
            temperature=ds_cfg.get("temperature", 0.9),
        ), "local"  # We manage history locally


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def main():
    logger.info("=== Voice Assistant Starting ===")

    # ---- 1. Load config ----
    cfg = load_config()
    provider = cfg.get("provider", "deepseek").lower()

    persona = cfg.get("persona", "")
    model_name = cfg.get("whisper_model", "base")
    language = cfg.get("whisper_language", None) or None
    sample_rate = cfg.get("sample_rate", 16000)
    chunk_duration = cfg.get("chunk_duration", 2.0)
    tts_engine = cfg.get("tts_engine", "edge-tts")
    max_history = cfg.get("max_history_turns", 10)

    virt_hint = cfg.get("virtual_device_name", {}).get(
        "windows" if sys.platform == "win32" else "macos", ""
    )
    tts_voice = cfg.get("tts_voice", {}).get(
        "win" if sys.platform == "win32" else "mac", None
    )

    # ---- 2. Check virtual device ----
    if not check_virtual_device():
        logger.error("Virtual audio device NOT found!")
        if sys.platform == "win32":
            print("Please install VB-Cable: https://vb-audio.com/Cable/")
        else:
            print("Please install BlackHole 2ch: brew install blackhole-2ch")
        sys.exit(1)

    # ---- 3. Backup + switch ----
    logger.info("Backing up current audio device...")
    backup_current_device()

    logger.info("Switching to virtual audio device...")
    if not set_virtual_as_default():
        logger.error("Failed to switch audio device. Exiting.")
        sys.exit(1)

    # ---- 4. Initialize modules ----
    recorder = AudioRecorder(
        device_name_hint=virt_hint,
        samplerate=sample_rate,
        chunk_duration=chunk_duration,
    )

    transcriber = Transcriber(model_name=model_name, language=language)

    client, history_mode = create_client(cfg)
    conversation_history: list[tuple[str, str]] = []

    # ---- 5. Graceful shutdown ----
    running = True

    def shutdown(sig, frame):
        nonlocal running
        logger.info("Shutdown signal received (%s)", sig)
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # ---- 6. Main loop ----
    logger.info("Starting capture loop (provider: %s). Press Ctrl+C to exit.", provider)
    print(f"\n  Voice Assistant running [{provider}]. Speak into the microphone.")
    print("  Press Ctrl+C to exit.\n")

    recorder.start()

    try:
        while running:
            chunk = recorder.read_chunk(timeout=1.0)
            if chunk is None:
                continue

            # ----- STT -----
            text = transcriber.transcribe(chunk, sample_rate)
            if not text:
                continue

            print(f"  You: {text}")

            # ----- AI Chat -----
            if history_mode == "local":
                response = client.chat_with_context(text, persona, conversation_history)
                conversation_history.append((text, response))
                while len(conversation_history) > max_history:
                    conversation_history.pop(0)
            else:
                # Coze manages history on the server
                response = client.chat(text)

            # ----- TTS -----
            print(f"  Pet: {response}")
            speak(response, engine=tts_engine, voice=tts_voice)

    except Exception as e:
        logger.exception("Unexpected error in main loop: %s", e)
    finally:
        recorder.stop()
        logger.info("Restoring original audio device...")
        restore_original()
        logger.info("=== Voice Assistant Stopped ===")


if __name__ == "__main__":
    main()
