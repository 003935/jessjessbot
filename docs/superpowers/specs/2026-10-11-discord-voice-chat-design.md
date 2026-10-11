# Discord voice chat with JessJessBot

## Goal

Let server members speak to JessJessBot in a Discord voice channel. When listening is enabled, the bot transcribes each member's speech, generates a chat reply using the speaker's identity, and speaks the reply through the existing OmniVoice clone.

## Scope

- Add `/listen enabled:true|false` to explicitly enable or disable voice transcription for the current guild.
- Listening is off by default, requires an existing `/join` voice session, and stops on `/leave` or a disconnected voice session.
- Capture separate utterances from human speakers, identify the speaker, transcribe locally on the NVIDIA GPU, and send recognized speech through JessJessBot's chat response flow.
- Speak replies in the connected voice channel using the existing per-guild playback queue.
- Keep audio transient in memory. Do not save voice recordings or publish transcripts in text chat. Keep ASR model files under the existing E: mounted model cache.
- Preserve the existing text-only behavior whenever listening is disabled or the bot is not in voice.

## Out of scope

- Wake-word detection, always-on listening, or automatic voice-channel joining.
- Persistent storage of recordings or transcripts.
- Cloud speech-to-text providers, speaker cloning for users, or multiple TTS identities.
- Full transcription captions in a Discord text channel.

## Architecture

1. **Discord receive path:** The existing voice connection currently joins self-deafened. When `/listen` is enabled, receive member Opus streams from the active connection, decode each speaker's utterance to PCM, and segment on silence. Ignore bot accounts and discard audio buffers after transcription. The receive path is inactive when listening is disabled.
2. **Local transcription:** Extend the private `omnivoice` service with a transcription endpoint backed by a compact English Whisper model on CUDA. Load the model once, serialize ASR and TTS GPU inference through a shared lock, and place its model cache under `/cache`, which is already mounted from `E:\\jessjessbot\\.local\\omnivoice-cache`. The faster-whisper project documents CUDA inference and configurable compute types: https://github.com/SYSTRAN/faster-whisper.
3. **Voice chat response:** Route each non-empty transcript to a voice-chat response handler with the Discord user ID and display name. Use JessJessBot's existing chat personality and a short in-memory per-speaker history for follow-ups while listening is enabled. Do not expose voice chat as authorization for destructive or administrative actions. Send the generated reply only through the existing TTS queue; do not post transcripts or replies in the text channel.
4. **Toggle lifecycle:** Add an explicit boolean `enabled` option to `/listen`. The command requires a cached guild and an active voice session, responds ephemerally, and changes only that guild's session. `/leave`, connection loss, or bot shutdown disables listening, clears pending audio, and clears in-memory voice-chat history.
5. **Runtime deployment:** Keep the transcription endpoint private on the Docker network. Reuse the existing GPU and E: cache mount; do not move model files, Docker data, or reference recordings to C:.

## Data flow

`/join → /listen enabled:true → member voice packets → in-memory utterance buffer → local GPU transcription → per-speaker chat response → existing OmniVoice speech queue → Discord VC`

When `/listen enabled:false` is set, incoming member audio is not subscribed to or retained. User utterances are processed one at a time per guild so the single GPU is not overloaded by overlapping recognition and synthesis. Replies are queued and played in order.

## Privacy and security

- Listening requires explicit opt-in for each active guild session and is visibly controlled by `/listen` status replies.
- Audio is processed by the local STT service and is never written to disk. Recognized text is sent to the bot's configured DeepSeek chat API to generate a response, but is not posted to Discord or saved as durable memory.
- Do not include user voice audio or transcript content in logs. Log only errors and aggregate operational status.
- Ignore bot users and cap utterance duration, transcript length, and queued turns to limit accidental or abusive input.
- The bot requires Connect, Speak, and the existing voice-state gateway access; report clear errors when prerequisites are missing.

## Failure handling

- STT service unavailable or invalid audio: discard the utterance, keep the bot connected, and continue listening without speaking a fabricated reply.
- DeepSeek or TTS failure: discard that reply, log a content-free error, and continue processing later utterances.
- Queue saturation: keep at most five pending utterances per guild; discard new utterances while full and avoid unbounded memory growth.
- `/listen` requested without an active voice connection: reply ephemerally with the `/join` instruction and leave listening disabled.

## Acceptance criteria

- `/listen enabled:true` starts capture in the current joined VC; `/listen enabled:false` stops capture immediately.
- `/leave` and unexpected disconnect stop audio capture and clear session audio/history buffers.
- A human utterance is transcribed locally, associated with its speaker, answered by the bot, and spoken back through the existing cloned voice.
- No raw audio files, public transcripts, transcript logs, or durable voice-conversation records are created.
- ASR and TTS model caches stay under the E: bind mount; the service uses the NVIDIA GPU and does not publish its HTTP endpoints to the host.
- Existing `/say`, `/join`, `/leave`, and text-mention speech continue to work.

## Review notes

- The proposed ASR model is English-only because the current bot voice and reference workflow are English. If multilingual voice input is needed, select a multilingual Whisper model before implementation.
- Sending recognized text to the configured DeepSeek API is necessary for the current chat backend; only the audio itself remains local.
