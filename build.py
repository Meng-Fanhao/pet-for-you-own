#!/usr/bin/env python3
"""PyInstaller build script – generates standalone .exe (Win) or .app (Mac)."""

import sys
from pathlib import Path

import PyInstaller.__main__


def build():
    root = Path(__file__).resolve().parent

    # Common PyInstaller args
    args = [
        str(root / "main.py"),
        "--onefile",
        "--name=VoiceAssistant",
        "--add-data", f"{root / 'config.yaml'}:.",
        "--console",
        "--clean",
    ]

    # Platform-specific binary bundling
    if sys.platform == "win32":
        # Bundle SoundVolumeView for Windows audio switching
        ssv = root / "tools" / "SoundVolumeView.exe"
        if ssv.exists():
            args += ["--add-data", f"{ssv}:."]
        else:
            print("Warning: SoundVolumeView.exe not found in tools/")
            print("  Download from https://www.nirsoft.net/utils/sound_volume_view.html")
            print("  Place it in pet-voice-assistant/tools/")

    elif sys.platform == "darwin":
        # SwitchAudioSource should be installed via brew on macOS
        # It's typically at /opt/homebrew/bin/SwitchAudioSource or /usr/local/bin/SwitchAudioSource
        import shutil
        sas = shutil.which("SwitchAudioSource")
        if sas:
            args += ["--add-binary", f"{sas}:."]
        else:
            print("Warning: SwitchAudioSource not found.")
            print("  Install it: brew install switchaudio-osx")
            print("  Users will need to install it separately.")

    print(f"Building with PyInstaller...")
    print(f"Args: {' '.join(args)}")
    PyInstaller.__main__.run(args)

    print("\nBuild complete! Output in dist/VoiceAssistant")
    if sys.platform == "win32":
        print("  Executable: dist/VoiceAssistant.exe")
    else:
        print("  Executable: dist/VoiceAssistant")


if __name__ == "__main__":
    build()
