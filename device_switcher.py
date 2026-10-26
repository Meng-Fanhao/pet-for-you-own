"""Audio device switching – dual-platform (Windows / macOS)."""

import os
import sys
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from utils import logger

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"

# ---------------------------------------------------------------------------
# Virtual device names (from config.yaml can override)
# ---------------------------------------------------------------------------
VIRTUAL_DEVICE_WIN = "CABLE Output"
VIRTUAL_DEVICE_MAC = "BlackHole 2ch"

# Backup file for original device settings
BACKUP_FILE = Path(tempfile.gettempdir()) / "voice_assistant_audio_backup.json"


def _run(cmd: list[str], timeout: int = 15) -> subprocess.CompletedProcess:
    """Run a command and return its result. Raises on non-zero exit."""
    logger.debug("Running: %s", " ".join(cmd))
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)


def check_virtual_device() -> bool:
    """Check if the virtual audio device driver is installed."""
    if IS_WIN:
        # VB-Cable: check via PowerShell
        try:
            r = _run(["powershell", "-Command",
                       "Get-PnpDevice | Where-Object {$_.FriendlyName -like '*VB-Audio*CABLE*'} | Select-Object -First 1"])
            return "VB-Audio" in r.stdout
        except Exception:
            pass
        # Fallback: try to find "CABLE" in sounddevice devices (if sounddevice is importable)
        try:
            import sounddevice as sd
            devices = sd.query_devices()
            return any("CABLE" in (d.get("name", "") or "") for d in devices)
        except Exception:
            pass
        return False

    elif IS_MAC:
        # BlackHole: check if the kext/driver is loaded
        try:
            r = _run(["system_profiler", "SPAudioDataType"])
            return "BlackHole" in r.stdout
        except Exception:
            pass
        return False

    return False


def backup_current_device() -> dict:
    """Backup the current default audio device to a temp file. Returns backup dict."""
    backup = {"platform": sys.platform}

    if IS_WIN:
        # Use PowerShell to query current default playback device
        try:
            r = _run(["powershell", "-Command",
                       "(Get-WmiObject Win32_SoundDevice | Where-Object {$_.Availability -eq 3}).Name"])
            backup["default_playback"] = r.stdout.strip()
        except Exception as e:
            logger.warning("Failed to backup Windows audio device: %s", e)

    elif IS_MAC:
        # Use SwitchAudioSource if available
        switch_bin = shutil.which("SwitchAudioSource")
        if switch_bin:
            try:
                r = _run([switch_bin, "-c"])
                backup["default_output"] = r.stdout.strip()
            except Exception as e:
                logger.warning("Failed to backup macOS audio device: %s", e)
        else:
            logger.warning("SwitchAudioSource not found; cannot backup audio device")

    # Save to file
    BACKUP_FILE.write_text(json.dumps(backup, indent=2))
    logger.info("Backed up audio device: %s", backup)
    return backup


def set_virtual_as_default() -> bool:
    """Set virtual audio device as the system default. Returns True if successful."""
    if IS_WIN:
        # Use SoundVolumeView (bundled) or PowerShell
        ssv = _find_tool("SoundVolumeView.exe")
        if ssv:
            try:
                _run([str(ssv), "/SetDefault", VIRTUAL_DEVICE_WIN, "all"])
                logger.info("Set default device to '%s' (SoundVolumeView)", VIRTUAL_DEVICE_WIN)
                return True
            except Exception as e:
                logger.warning("SoundVolumeView failed: %s", e)

        # Fallback: PowerShell
        try:
            ps_cmd = (
                f"$d = Get-WmiObject Win32_SoundDevice | Where-Object {{$_.Name -like '*{VIRTUAL_DEVICE_WIN}*'}}; "
                "if ($d) { $d.SetDefault() }"
            )
            _run(["powershell", "-Command", ps_cmd])
            logger.info("Set default device to '%s' (PowerShell)", VIRTUAL_DEVICE_WIN)
            return True
        except Exception as e:
            logger.error("Failed to set Windows default audio device: %s", e)
            return False

    elif IS_MAC:
        switch_bin = shutil.which("SwitchAudioSource")
        if switch_bin:
            try:
                _run([switch_bin, "-s", VIRTUAL_DEVICE_MAC])
                logger.info("Set default output to '%s' (SwitchAudioSource)", VIRTUAL_DEVICE_MAC)
                return True
            except Exception as e:
                logger.error("SwitchAudioSource failed: %s", e)
                return False
        else:
            logger.error("SwitchAudioSource not found on macOS. Install: brew install switchaudio-osx")
            return False

    return False


def restore_original() -> bool:
    """Restore the original audio device from backup. Returns True if successful."""
    if not BACKUP_FILE.exists():
        logger.warning("No backup file found; nothing to restore")
        return False

    backup = json.loads(BACKUP_FILE.read_text())

    if IS_WIN:
        device_name = backup.get("default_playback", "")
        if not device_name:
            return False
        ssv = _find_tool("SoundVolumeView.exe")
        if ssv:
            try:
                _run([str(ssv), "/SetDefault", device_name, "all"])
                logger.info("Restored default device to '%s'", device_name)
                BACKUP_FILE.unlink(missing_ok=True)
                return True
            except Exception as e:
                logger.warning("SoundVolumeView restore failed: %s", e)
        return False

    elif IS_MAC:
        device_name = backup.get("default_output", "")
        if not device_name:
            return False
        switch_bin = shutil.which("SwitchAudioSource")
        if switch_bin:
            try:
                _run([switch_bin, "-s", device_name])
                logger.info("Restored default output to '%s'", device_name)
                BACKUP_FILE.unlink(missing_ok=True)
                return True
            except Exception as e:
                logger.error("SwitchAudioSource restore failed: %s", e)
        return False

    return False


def _find_tool(name: str) -> Path | None:
    """Find a bundled tool (relative to this script or in PATH)."""
    # Check alongside this script first (PyInstaller bundle)
    local = Path(__file__).resolve().parent / name
    if local.exists():
        return local
    # Check PATH
    found = shutil.which(name)
    if found:
        return Path(found)
    # Check _internal (PyInstaller macOS .app)
    internal = Path(sys._MEIPASS) / name if hasattr(sys, "_MEIPASS") else None
    if internal and internal.exists():
        return internal
    return None
