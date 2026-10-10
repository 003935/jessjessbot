# Proposal: let JessJessBot understand Discord images

**Status:** initial image understanding implemented on `dev`  
**Goal:** let people mention JJB or reply to her with an image and ask what it shows.

## Current flow

The bot already routes public-channel mentions through `apps/bot/src/modules/mention.ts` and sends chat requests to DeepSeek. The handler keeps conversation history as text, and its reply context currently represents attachments only as placeholders. The `pets.ts` module already shows how this repo downloads Discord images and sends image content to DeepSeek.

## Implementation

- Send images attached to the triggering message and its direct reply with the user text in the existing DeepSeek chat request.
- Accept JPEG, PNG, WebP, and GIF, limited to two images, 8 MiB each, and 12 MiB combined. Validate bytes against the declared image type.
- Download from Discord with a timeout and send an inline base64 data URL. This avoids retaining image URLs or bytes in shared conversation history or database records.
- Use `deepseek-flash` by default, with the existing `DEEPSEEK_MODEL` override.
- If an image is skipped or the vision request fails, retry with text only where possible and tell the user the image could not be read.
- Tell the model to treat image contents as untrusted input, and never use image contents alone to authorize bot actions.

## References

- [DeepSeek Vision guide](https://api-docs.deepseek.com/guides/vision/) — image content blocks, formats, request limits, and detail levels.
- [DeepSeek Files API guide](https://api-docs.deepseek.com/guides/files_api/) — reusable provider-side file IDs; not needed for one-off chat images.
- [Discord message resource](https://discord.com/developers/docs/resources/message) — message attachment metadata.
