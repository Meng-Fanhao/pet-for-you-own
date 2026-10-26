"""Audio capture via sounddevice – unified cross-platform interface."""

import time
import queue
import threading
import numpy as np
import sounddevice as sd
from utils import logger


class AudioRecorder:
    """Continuously captures audio from a specified device into a buffer queue."""

    def __init__(
        self,
        device_name_hint: str | None = None,
        samplerate: int = 16000,
        chunk_duration: float = 2.0,
        channels: int = 1,
    ):
        self.samplerate = samplerate
        self.chunk_duration = chunk_duration
        self.chunk_samples = int(samplerate * chunk_duration)
        self.channels = channels

        # Find device index
        self.device_index = self._find_device(device_name_hint)
        if self.device_index is None:
            raise RuntimeError(
                f"Virtual audio device not found (hint: '{device_name_hint}'). "
                "Install VB-Cable (Windows) or BlackHole (macOS)."
            )

        self._stream: sd.InputStream | None = None
        self._buffer_queue: queue.Queue = queue.Queue()
        self._running = False
        self._thread: threading.Thread | None = None

        logger.info("AudioRecorder ready: device=%d, sr=%d, chunk=%.1fs",
                     self.device_index, samplerate, chunk_duration)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self):
        """Open the input stream and start background capture thread."""
        if self._running:
            return

        self._stream = sd.InputStream(
            device=self.device_index,
            samplerate=self.samplerate,
            channels=self.channels,
            dtype="float32",
            callback=self._audio_callback,
        )
        self._running = True
        self._stream.start()

        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()
        logger.info("Audio capture started")

    def read_chunk(self, timeout: float | None = None) -> np.ndarray | None:
        """Get the next audio chunk (float32 array, shape=(samples,)) or None on timeout."""
        try:
            return self._buffer_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def stop(self):
        """Stop capture and close the stream."""
        self._running = False
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None
        logger.info("Audio capture stopped")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status):
        """sounddevice callback – pushes data into an internal list."""
        if status:
            logger.debug("Audio callback status: %s", status)
        self._buffer_queue.put(indata.copy().flatten())

    def _reader_loop(self):
        """Background thread: drains the sounddevice ring buffer (handled by callback)."""
        while self._running:
            time.sleep(0.05)

    @staticmethod
    def _find_device(name_hint: str | None) -> int | None:
        """Find a device index by name substring. Returns first match or None."""
        devices = sd.query_devices()
        if not name_hint:
            # Try common virtual device names
            hints = ["CABLE", "BlackHole", "VB-Audio"]
            for d in devices:
                dn = d.get("name", "") or ""
                if any(h.lower() in dn.lower() for h in hints):
                    if d.get("max_input_channels", 0) > 0:
                        logger.info("Auto-detected virtual device: %s (index %d)", dn, d["index"])
                        return d["index"]
        else:
            for d in devices:
                dn = d.get("name", "") or ""
                if name_hint.lower() in dn.lower() and d.get("max_input_channels", 0) > 0:
                    logger.info("Found virtual device: %s (index %d)", dn, d["index"])
                    return d["index"]
        return None


def find_virtual_device_index(name_hint: str | None = None) -> int | None:
    """Convenience: find index of a virtual audio device."""
    return AudioRecorder._find_device(name_hint)
