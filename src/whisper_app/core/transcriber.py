import io
from typing import Optional
from faster_whisper import WhisperModel

_model: Optional[WhisperModel] = None
_model_name: str = ""
_device: str = ""


def load_model(model_name: str, device: str = "cpu") -> None:
    global _model, _model_name, _device
    if _model is None or _model_name != model_name or _device != device:
        _model = WhisperModel(model_name, device=device, compute_type="int8")
        _model_name = model_name
        _device = device


def transcribe(wav_bytes: bytes, language: Optional[str] = None) -> str:
    if _model is None:
        raise RuntimeError("Model not loaded — call load_model() first")
    segments, _ = _model.transcribe(
        io.BytesIO(wav_bytes),
        language=language,
        vad_filter=True,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()
