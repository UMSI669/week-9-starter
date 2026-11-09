#!/usr/bin/env python3
"""Generate the bundled SYNTHETIC demo interviews (macOS only).

Reads scripts/sample-interviews.json, synthesizes each segment with the macOS
`say` command as 16 kHz mono 16-bit PCM WAV, concatenates the segments with a
short pause, and writes:

  assets/audio/<id>.wav                 bundled demo audio
  src/data/sampleInterviews.json        transcript segments with exact timestamps

Run from the project root:  python3 scripts/generate-sample-audio.py
"""

import json
import os
import subprocess
import sys
import tempfile
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "scripts", "sample-interviews.json")
AUDIO_DIR = os.path.join(ROOT, "assets", "audio")
OUTPUT_JSON = os.path.join(ROOT, "src", "data", "sampleInterviews.json")

SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2  # bytes, 16-bit PCM
PAUSE_MS = 450


def synthesize(text: str, voice: str, out_path: str) -> None:
    subprocess.run(
        ["say", "-v", voice, "-r", "185", "-o", out_path,
         f"--data-format=LEI16@{SAMPLE_RATE}", "--channels=1", text],
        check=True,
    )


def read_frames(path: str) -> bytes:
    with wave.open(path, "rb") as wav:
        if wav.getframerate() != SAMPLE_RATE or wav.getnchannels() != 1 or wav.getsampwidth() != SAMPLE_WIDTH:
            raise RuntimeError(f"Unexpected WAV format from say: {path}")
        return wav.readframes(wav.getnframes())


def main() -> int:
    if sys.platform != "darwin":
        print("This generator uses the macOS `say` command.", file=sys.stderr)
        return 1

    config = json.load(open(SOURCE, encoding="utf-8"))
    os.makedirs(AUDIO_DIR, exist_ok=True)
    pause = b"\x00\x00" * int(SAMPLE_RATE * PAUSE_MS / 1000)
    output = []

    with tempfile.TemporaryDirectory() as tmp:
        for interview in config["interviews"]:
            voices = dict(config["voices"])
            override = config.get("participantVoiceOverrides", {}).get(interview["id"])
            if override:
                voices["Participant"] = override

            pcm = bytearray()
            segments = []
            for index, segment in enumerate(interview["segments"]):
                part = os.path.join(tmp, f"{interview['id']}-{index}.wav")
                synthesize(segment["text"], voices[segment["speaker"]], part)
                frames = read_frames(part)
                start_ms = round(len(pcm) / SAMPLE_WIDTH / SAMPLE_RATE * 1000)
                pcm.extend(frames)
                end_ms = round(len(pcm) / SAMPLE_WIDTH / SAMPLE_RATE * 1000)
                pcm.extend(pause)
                segments.append({
                    "id": f"seg_{index + 1:03d}",
                    "speaker": segment["speaker"],
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "text": segment["text"],
                })

            audio_name = f"{interview['id']}.wav"
            with wave.open(os.path.join(AUDIO_DIR, audio_name), "wb") as out:
                out.setnchannels(1)
                out.setsampwidth(SAMPLE_WIDTH)
                out.setframerate(SAMPLE_RATE)
                out.writeframes(bytes(pcm))

            output.append({
                "id": interview["id"],
                "title": interview["title"],
                "participantLabel": interview["participantLabel"],
                "audioFile": audio_name,
                "durationMs": round(len(pcm) / SAMPLE_WIDTH / SAMPLE_RATE * 1000),
                "segments": segments,
            })
            print(f"wrote assets/audio/{audio_name} ({output[-1]['durationMs'] / 1000:.1f}s)")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as fh:
        json.dump({"synthetic": True, "interviews": output}, fh, indent=2)
        fh.write("\n")
    print("wrote src/data/sampleInterviews.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
