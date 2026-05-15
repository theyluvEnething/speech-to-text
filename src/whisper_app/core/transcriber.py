import io
from typing import Optional
from faster_whisper import WhisperModel

_model: Optional[WhisperModel] = None
_model_name: str = ""
_device: str = ""


def load_model(model_name: str, device: str = "cpu") -> str:
    """Load the Whisper model. Returns the actual device used (may fall back to CPU)."""
    global _model, _model_name, _device
    if _model is not None and _model_name == model_name and _device == device:
        return _device

    if device == "cuda":
        try:
            _model = WhisperModel(model_name, device="cuda", compute_type="int8_float16")
        except RuntimeError as e:
            print(f"[Whisper] GPU init failed: {e}")
            print("[Whisper] Falling back to CPU — install NVIDIA CUDA 12 to use GPU.")
            device = "cpu"

    if device == "cpu":
        _model = WhisperModel(model_name, device="cpu", compute_type="int8")

    _model_name = model_name
    _device = device
    return _device


def transcribe(wav_bytes: bytes, language: Optional[str] = None) -> str:
    if _model is None:
        raise RuntimeError("Model not loaded — call load_model() first")
    segments, _ = _model.transcribe(
        io.BytesIO(wav_bytes),
        language=language,
        vad_filter=True,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()
