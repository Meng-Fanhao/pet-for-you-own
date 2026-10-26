#!/bin/bash
# Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
# macOS Setup & Build Script for Desktop Pet
set -e

echo "========================================"
echo "  Desktop Pet - macOS Setup & Build"
echo "========================================"
echo ""

# Check Node.js
echo "[1/3] Checking Node.js..."
if command -v node &> /dev/null; then
    echo "  Node.js found: $(node --version)"
else
    echo "  Node.js not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install node
    else
        echo "  Homebrew not found. Please install Node.js from https://nodejs.org"
        exit 1
    fi
fi

# Check Rust
echo "[2/3] Checking Rust toolchain..."
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi
if command -v rustc &> /dev/null; then
    echo "  Rust found: $(rustc --version)"
else
    echo "  Rust not found. Installing via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Build
echo "[3/3] Building Desktop Pet..."
cd "$(dirname "$0")/.."
npm install
npm run tauri build

echo ""
echo "========================================"
echo "  Build Complete!"
echo "  App: src-tauri/target/release/bundle/macos/"
echo "========================================"
