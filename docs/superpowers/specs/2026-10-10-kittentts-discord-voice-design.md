# JessJessBot voice cloning and Discord voice design

## Goal

Let JessJessBot speak its generated text replies in a Discord voice channel using the user's own voice as a local KittenTTS 2 voice reference. The setup should work with the existing TypeScript/Bun bot and Docker Compose project without publishing the voice recording or credentials.

## Scope

- Run KittenTTS 2 locally for speech generation, using a 5–30 second single-speaker reference recording supplied by the user.
- Add Discord voice support to the bot.
- Provide `/join` and `/leave` commands. `/join` connects to the invoking member's current voice channel; `/leave` disconnects.
- Speak JessJessBot's ordinary text replies in the connected channel. Continue sending those replies in text as today.
- Queue speech per guild so generated clips play in order and do not overlap.
- Keep cloning opt-in through local configuration; do not commit, log, upload, or include the reference recording in generated artifacts.

## Out of scope

- Listening to or transcribing member audio.
- Speaking every message in a channel, or connecting automatically when someone joins.
- Training/fine-tuning a model or supporting multiple cloned identities.
- Dashboard controls, cloud TTS, or a public voice-cloning endpoint.

## Architecture

1. **Local KittenTTS service:** Add a small Python service/container that loads `KittenML/kitten-tts-2` once and exposes a private, local HTTP endpoint for text-to-WAV generation. The service reads the configured reference WAV from a bind-mounted, ignored local data directory. It must not expose a public port. The model supports `reference=` cloning and CPU operation; its documented baseline is roughly 6 GB RAM. The repository's model weights have a separate license from the Apache-2.0 code, so include a setup note to review the model license before use.
2. **Discord voice layer:** Add `@discordjs/voice`, enable the `GuildVoiceStates` gateway intent, and use the Discord guild voice adapter. The bot needs Connect and Speak permissions in the target channel. Add `/join` and `/leave` slash commands using the project's existing command registration conventions.
3. **Reply audio:** After the existing mention handler sends a normal text reply, submit the same reply text to the local service when the guild has an active voice connection. Play the returned WAV through an audio player. If synthesis or playback fails, log a concise error and leave the text reply intact.
4. **Configuration and private data:** Add an optional local reference path/configuration entry and service URL. Add the voice sample directory and generated temporary audio to `.gitignore`. Document recording requirements, setup, and how to replace/remove the sample. Never put sample audio into logs, API payloads outside localhost, or version control.

## Data flow

`mentioned message → existing Jess reply generation → text reply posted → if connected: local TTS request → cloned-voice audio returned → queued audio playback in that guild's VC`

The voice connection is explicit and session-based: `/join` connects only the invoking member's current channel. `/leave` destroys that guild's connection and clears pending speech. A guild can have one active connection, consistent with Discord voice behavior.

## Failure handling

- Missing voice sample or unavailable TTS service: do not block or retract the text reply; record a useful setup/runtime error without sample contents.
- User is not in a voice channel when invoking `/join`: respond ephemerally with a clear instruction.
- Missing Connect/Speak permission or inaccessible channel: report the failure ephemerally.
- Service timeout or invalid audio: skip that clip and continue processing subsequent replies.
- Bot shutdown: stop queues, destroy voice connections, and close the TTS service cleanly through Compose shutdown.

## Security and privacy

- The reference recording belongs to the user and stays on the machine running the local service. Keep it in an ignored bind-mounted directory with restrictive local permissions where available.
- Bind the TTS endpoint to the Compose network only; do not publish it to the host or internet by default.
- Do not support arbitrary remote reference URLs or accept sample files through a public Discord command.
- Limit synthesis input to the same bounded reply text the bot already posts, and apply request timeout/size limits.

## Acceptance criteria

- Setup instructions explain how to provide a clean 5–30 second recording and start the local KittenTTS service.
- A local synthesis smoke check can create a playable WAV in the configured cloned voice.
- `/join` connects the bot to the caller's current voice channel; `/leave` disconnects it.
- A normal summoned reply is both posted as text and spoken in the connected voice channel; with no connection, behavior remains text-only.
- Multiple replies play sequentially, and failures in TTS do not interrupt text chat or the bot process.
- The reference recording is ignored by Git and not sent outside the local Compose network.

## Review note

This design assumes the bot should speak only its own summoned replies while explicitly joined, and that the user's recording is available as a local WAV file. The bot will not listen to members' voice audio.
