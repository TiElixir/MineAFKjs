# TiElixir

TiElixir is a configurable Minecraft companion bot built with Mineflayer. It can maintain a server connection, move to a configured location, keep active, send scheduled chat messages, and expose a local health endpoint.

## Requirements

- Node.js 18 or newer
- A Minecraft server that permits bot connections

## Setup

```bash
npm install
```

Edit `settings.json`:

- Set `server.ip`, `server.port`, and `server.version`. Use `false` for version to let Mineflayer auto-detect it.
- Add one or more account names under `bot-account.usernames`. For Microsoft authentication, set `bot-account.type` to `microsoft`; for offline-mode servers, use `offline`.
- Enable or disable movement, anti-AFK behavior, automatic authentication, chat messages, and reconnects under `utils`.

Start the bot:

```bash
npm start
```

Use `Ctrl+C` to shut down cleanly. Automatic account rotation is persisted in the ignored `lastIndex.dat` file.

## Configuration notes

- `position.enabled` moves the bot to the configured block coordinates after it spawns. Pathfinding will not dig blocks.
- `utils.anti-afk` enables jump and optional sneak controls. Confirm these actions comply with your server's rules.
- `utils.chat-messages` sends the configured message list on spawn and optionally repeats it after `repeat-delay` seconds. Set it to `false` to disable automated messages.
- `utils.auto-auth` sends `/login <password>` when a login/register prompt is detected. Use only on servers where you trust the server and its operators; do not reuse a sensitive password.
- `utils.auto-reconnect` retries after disconnects using `auto-reconnect-delay` in milliseconds.

## Health endpoint

The process serves `GET /health` on `127.0.0.1:3000` by default. It returns JSON status and responds with HTTP 200 only while connected; otherwise it responds with HTTP 503. Set `STATUS_HOST` and `STATUS_PORT` to change the bind address and port. Keep this endpoint on loopback or behind a trusted proxy.

## Development

```bash
npm test
```

TiElixir is provided as-is. Follow the Minecraft server's rules and obtain authorization before connecting automated clients.
