#!/usr/bin/env python3
"""
One-click installer for Voice Assistant.
Automatically detects platform, installs dependencies, and builds executable.

Usage:
    python install.py              # Interactive install
    python install.py --build      # Install + build .exe/.app
    python install.py --run        # Install + run directly
"""

import sys
import subprocess
import shutil
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def run(cmd, desc="", check=True, shell=False):
    if desc:
        print(f"  {desc}...")
    if isinstance(cmd, str) and not shell:
        cmd = cmd.split()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=check, shell=shell)
        if result.returncode != 0 and check:
            print(f"  ERROR: {result.stderr.strip()}")
            return False
        return True
    except FileNotFoundError:
        if check:
            print(f"  ERROR: command not found: {cmd[0] if isinstance(cmd, list) else cmd}")
        return False


def python():
    return sys.executable


# ---------------------------------------------------------------------------
# Platform-specific steps
# ---------------------------------------------------------------------------
def check_python():
    print("\n[1/5] Checking Python...")
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 10):
        print(f"  ERROR: Python 3.10+ required, found {v.major}.{v.minor}")
        return False
    print(f"  Python {v.major}.{v.minor}.{v.micro} ✓")
    return True


def install_virtual_driver():
    print("\n[2/5] Virtual audio driver...")
    if IS_WIN:
        vbcable = ROOT / "tools" / "VBCABLE_Setup_x64.exe"
        if vbcable.exists():
            print("  Installing VB-Cable (requires admin)...")
            result = run([str(vbcable), "-silent"], desc="VB-Cable", check=False)
            if result:
                print("  VB-Cable installed ✓")
                return True
        print("  VB-Cable installer not found in tools/")
        print("  Download from: https://vb-audio.com/Cable/")
        print("  Place VBCABLE_Setup_x64.exe in tools/ and re-run.")
        return False
    elif IS_MAC:
        if shutil.which("brew"):
            print("  Installing BlackHole 2ch via Homebrew...")
            if run("brew install blackhole-2ch", desc="BlackHole", check=False):
                print("  BlackHole installed ✓")
                return True
        print("  Homebrew not found. Install it first: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
        print("  Then run: brew install blackhole-2ch")
        return False
    return False


def install_switch_tools():
    print("\n[3/5] Audio switching tools...")
    if IS_WIN:
        ssv = ROOT / "tools" / "SoundVolumeView.exe"
        if not ssv.exists():
            print("  Downloading SoundVolumeView...")
            import urllib.request
            import zipfile
            url = "https://www.nirsoft.net/utils/soundvolumeview.zip"
            zip_path = ROOT / "tools" / "soundvolumeview.zip"
            try:
                urllib.request.urlretrieve(url, zip_path)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extract("SoundVolumeView.exe", ROOT / "tools")
                zip_path.unlink()
                print("  SoundVolumeView downloaded ✓")
            except Exception as e:
                print(f"  Failed to download: {e}")
                print("  Manual download: https://www.nirsoft.net/utils/sound_volume_view.html")
                return False
        else:
            print("  SoundVolumeView.exe found ✓")
        return True
    elif IS_MAC:
        if shutil.which("brew"):
            if not shutil.which("SwitchAudioSource"):
                print("  Installing SwitchAudioSource...")
                run("brew install switchaudio-osx", desc="SwitchAudioSource")
            else:
                print("  SwitchAudioSource already installed ✓")
            return True
        return False
    return False


def install_python_deps():
    print("\n[4/5] Python dependencies...")
    req = ROOT / "requirements.txt"
    if not req.exists():
        print("  requirements.txt not found!")
        return False
    result = run([python(), "-m", "pip", "install", "-r", str(req)], desc="pip install")
    if result:
        print("  Dependencies installed ✓")
        return True
    return False


def setup_config():
    print("\n[5/5] Configuration...")
    local = ROOT / "config.local.yaml"
    if local.exists():
        print("  config.local.yaml already exists ✓")
        return True

    api_key = input("  Enter your DeepSeek API key (or press Enter to skip): ").strip()
    if api_key:
        template = ROOT / "config.yaml"
        if template.exists():
            content = template.read_text()
            content = content.replace('api_key: ""', f'api_key: "{api_key}"')
            local.write_text(content)
            print("  config.local.yaml created ✓")
            return True
    print("  Skipped. Edit config.local.yaml later to add your API key.")
    return True


# ---------------------------------------------------------------------------
# Build / Run
# ---------------------------------------------------------------------------
def build_executable():
    print("\n[Build] Creating standalone executable...")
    build_script = ROOT / "build.py"
    if build_script.exists():
        return run([python(), str(build_script)], desc="PyInstaller build", check=False)
    print("  build.py not found")
    return False


def run_app():
    print("\n[Run] Starting Voice Assistant...")
    main = ROOT / "main.py"
    if main.exists():
        subprocess.run([python(), str(main)])
        return True
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("  Voice Assistant - One-Click Installer")
    print("=" * 60)

    build_flag = "--build" in sys.argv
    run_flag = "--run" in sys.argv

    steps = [
        check_python,
        install_virtual_driver,
        install_switch_tools,
        install_python_deps,
        setup_config,
    ]

    for step in steps:
        if not step():
            print(f"\n  Setup incomplete. Fix the issue above and re-run.")
            print(f"  For manual installation guide, see: {ROOT / 'drivers_guide' / 'README.md'}")
            return

    print("\n" + "=" * 60)
    print("  Installation complete!")
    print("=" * 60)

    if build_flag:
        build_executable()

    if run_flag:
        run_app()
    elif not build_flag:
        print(f"\n  To run now:  python main.py")
        print(f"  To build:    python install.py --build")


if __name__ == "__main__":
    main()
