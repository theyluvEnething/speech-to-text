import io
import threading
import wave
import numpy as np
import sounddevice as sd

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = "int16"


class AudioRecorder:
    def __init__(self):
        self._chunks: list[np.ndarray] = []
        self._lock = threading.Lock()
        self._stream: sd.InputStream | None = None
        self._rms: float = 0.0
        self._peak: float = 0.0
        self._sample_count: int = 0

    @property
    def rms(self) -> float:
        return self._rms

    @property
    def peak(self) -> float:
        return self._peak

    @property
    def sample_count(self) -> int:
        return self._sample_count

    def start(self) -> None:
        with self._lock:
            self._chunks = []
            self._rms = 0.0
            self._peak = 0.0
            self._sample_count = 0
        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype=DTYPE,
            callback=self._callback,
        )
        self._stream.start()

    def stop(self) -> tuple[bytes, float] | tuple[None, None]:
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None
        with self._lock:
            chunks = list(self._chunks)
            total_samples = self._sample_count
        if not chunks:
            return None, None
        audio = np.concatenate(chunks, axis=0)
        duration = total_samples / SAMPLE_RATE
        return _to_wav(audio), duration

    def _callback(self, indata: np.ndarray, frames: int, time, status) -> None:
        with self._lock:
            self._chunks.append(indata.copy())
            self._sample_count += frames
            rms = float(np.sqrt(np.mean(indata.astype(np.float64) ** 2)))
            self._rms = rms
            if rms > self._peak:
                self._peak = rms


def _to_wav(audio: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)  # int16 = 2 bytes
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio.tobytes())
    return buf.getvalue()
