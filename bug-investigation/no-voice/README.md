# Minimal voice bot (no Docker)

Plays an MP3 when someone types `tp!<clip-name>` in a text channel. Uses **system ffmpeg** (must be on PATH).

## Setup

1. Copy `.env.example` to `.env` and set `BOT_TOKEN`.
2. Put `.mp3` files in this folder (e.g. `bigdogs.mp3` → `tp!bigdogs`).
3. Ensure **ffmpeg** is installed and on your PATH.
4. Install and run:

```bash
npm install
npm start
```

## Env

- `BOT_TOKEN` – Discord bot token (from Developer Portal).

## Command

- `tp!<clip-name>` – plays `<clip-name>.mp3` if it exists in this folder. You must be in a voice channel.
