import wave
import io
import numpy as np
from whisper_app.core.audio import _to_wav, SAMPLE_RATE, CHANNELS


def test_to_wav_produces_valid_wav():
    dummy = np.zeros((SAMPLE_RATE,), dtype="int16")  # 1 second of silence
    wav_bytes = _to_wav(dummy)

    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getnchannels() == CHANNELS
        assert wf.getframerate() == SAMPLE_RATE
        assert wf.getsampwidth() == 2
        assert wf.getnframes() == SAMPLE_RATE
