import tempfile
import os

# Lazy-load the model to avoid slow startup if STT isn't needed
_model = None

def _get_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            _model = WhisperModel("base", device="cpu", compute_type="int8")
            print("[STT] Whisper model loaded (base, CPU, int8)")
        except Exception as e:
            print(f"[STT] Failed to load Whisper model: {e}")
            print("[STT] STT will return empty transcripts. Install faster-whisper to enable.")
            return None
    return _model


async def transcribe_audio(audio_bytes: bytes) -> dict:
    """Transcribe audio bytes to text with language detection."""
    model = _get_model()

    if model is None:
        return {
            "text": "",
            "language": "en",
            "language_probability": 0.0,
            "duration": 0.0,
        }

    # Save to temp file (faster-whisper needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name

    try:
        segments, info = model.transcribe(
            temp_path,
            language=None,           # Auto-detect language
            beam_size=5,
            vad_filter=True,         # Filter out non-speech
            vad_parameters=dict(
                min_silence_duration_ms=300,
            ),
        )

        text = " ".join(segment.text for segment in segments)

        return {
            "text": text.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
        }
    except Exception as e:
        print(f"[STT] Transcription error: {e}")
        return {
            "text": "",
            "language": "en",
            "language_probability": 0.0,
            "duration": 0.0,
        }
    finally:
        os.unlink(temp_path)
