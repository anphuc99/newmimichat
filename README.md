# New Mimi Chat (Full Stack)

Full-stack MimiChat refactor: React (Vite) client + Express (TypeScript) server + MySQL (TypeORM) + OpenAI chat.

Core features implemented so far:
- JWT auth (register/login) + signup gated by a `REGISTRATION_TOKEN`
- CEFR levels A0–C2 stored in DB (seed script) + user can select their level
- Characters CRUD, avatar upload (served under `/public`), optional voice selection
- Chat endpoint backed by OpenAI
- File-backed chat history (JSONL stored in `.txt`) scoped by `sessionId`
- System instruction stored in history (for stable prompting / caching)
- Character context injected via per-session **developer messages** (add/remove)

## Requirements

- Node.js 18+ (recommended)
- npm 9+
- MySQL running locally (or reachable remotely)

## Install

```bash
npm install
```

## Environment setup

The server auto-loads dotenv from either:
- `.env` (repo root), or
- `server/.env`

Examples exist under `server/.env.example` and `server/.env.ex`.

Minimum server env (local):

```bash
# Server
PORT=4000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mimi_chat

# Auth
JWT_SECRET=replace_me
REGISTRATION_TOKEN=replace_me

# OpenAI
OPENAI_API_KEY=replace_me
OPENAI_MODEL=gpt-4.1-mini
# Optional (defaults to server/src/prompts/chat.system.txt)
# OPENAI_SYSTEM_PROMPT_PATH=

# Optional chat history directory
# CHAT_HISTORY_DIR=server/data/chat-history
```

Client env (optional):

```bash
# client/.env.local
VITE_API_BASE_URL=http://localhost:4000
```

If `VITE_API_BASE_URL` is not set, the client uses same-origin requests.

## Database

Create/update tables in local dev (TypeORM sync; do not use in production):

```bash
npm run db:sync
```

Reset and recreate all tables (destructive, local only):

```bash
npm run db:reset
```

Seed default CEFR levels (A0–C2):

```bash
npm run db:seed:levels
```

## Development

Runs both the server and client concurrently:

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000

Note: if the server cannot initialize the data source (e.g. MySQL not running / wrong DB env), it will exit with code 1.

## Build

```bash
npm run build
```

## Lint / Format

```bash
npm run lint
npm run format
```

## Tests

Unit tests live outside `client/` and `server/` under `tests/`.

```bash
npm test
```

## Project structure

- `client/`: React (Vite)
- `server/`: Express API + TypeORM + services
- `tests/`: Vitest unit tests (controllers)
- `Tool/`: MVC scaffolding scripts

## MVC generator

Rules: `Tool/MVC_RULES.md`

Scaffold a new view group with controller/model:

```bash
npm run mvc:gen -- --group home
```

Optional flags:
- `--view <ViewName>`
- `--entity <EntityName>`
- `--child <ChildName>`
- `--force`

## Chat history (file-backed, session scoped)

Chat history is persisted to newline-delimited JSON (JSONL) stored in a `.txt` file per user + `sessionId`.
This allows reload-after-restart and helps keep prompts stable for OpenAI prompt caching.

Details:
- Stored roles include `system`, `developer`, `user`, `assistant`
- The system instruction is stored as the first history entry
- Developer messages are used to inject/remove character context per session

Optional env:
- `CHAT_HISTORY_DIR` (default: `server/data/chat-history`)

## Characters in chat (developer messages)

Characters are not embedded into the system prompt. Instead, the client explicitly adds/removes characters for a chat session.
Those actions append a `developer` message to the session history.

## API

Health/Home:
- `GET /api/health`
- `GET /api/home/message`

Auth/Users:
- `POST /api/users/register` (requires `registerToken` matching `REGISTRATION_TOKEN`)
- `POST /api/users/login`
- `GET /api/users/me`
- `PUT /api/users/level`

Levels:
- `GET /api/levels`

Chat:
- `POST /api/chat/send` (expects `message` and `sessionId`; also accepts optional context fields)
- `GET /api/chat/history?sessionId=...`
- `POST /api/chat/developer` (append developer messages; e.g. `character_added` / `character_removed`)

Chat response format:
- The assistant reply is a JSON array of objects with `CharacterName`, `Text`, `Tone`, `Translation`.

Characters:
- `GET /api/characters`
- `POST /api/characters/upload-avatar`
- `POST /api/characters`
- `PUT /api/characters/:id`
- `DELETE /api/characters/:id`

Static assets:
- `GET /public/...` (serves uploaded avatars from the server)
