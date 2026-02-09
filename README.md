# New Mimi Chat (Full Stack)

Full-stack MimiChat refactor: React (Vite) client + Express (TypeScript) server + MySQL (TypeORM) + OpenAI chat.

Core features implemented so far:
- JWT auth (register/login) + signup gated by a `REGISTRATION_TOKEN`
- CEFR levels A0–C2 stored in DB (auto-seeded on server start; seed script also available) + user can select their level
- Characters CRUD, avatar upload (served under `/public`), optional voiceName selection + per-character pitch/speakingRate
- Chat endpoint backed by OpenAI
- OpenAI TTS playback with cached audio (hash includes text + tone + voice)
- Journal summaries + message persistence on conversation end
- Vocabulary collection + FSRS spaced repetition (Due/Learn/Difficult/Starred)
- Vocabulary memories: rich-text notes with linked messages via `[MSG:<messageId>]` markers (and optional `[IMG:<url>]`)
- Translation drill with FSRS scheduling (Due/Learn/Difficult/Starred)
- Translation drill AI explanations (cached Markdown) + saved learner translations
- Translation drill audio playback (reuses chat TTS audio, applies character pitch/speakingRate)
- Listening drill with FSRS scheduling (Due/Learn/Difficult/Starred)
- Shadowing drill with FSRS scheduling + OpenAI `gpt-4o-transcribe` scoring
- Stories (user-created) with description + current progress, linked to journals
- File-backed chat history (JSONL stored in `.txt`) scoped by `sessionId`
- System instruction stored in history (for stable prompting / caching)
- Character context injected via per-session **developer messages** (add/remove)

## Requirements

- Node.js 18+ (recommended)
- npm 9+
- A database:
  - MySQL running locally (or reachable remotely), or
  - SQLite (file-based)

## Install

```bash
npm install
```

## Environment setup

The server auto-loads dotenv from either:
- `.env` (repo root), or
- `server/.env`

Examples exist under `.env.ex` and `server/.env.ex`.

Minimum server env (local):

```bash
# Server
PORT=4000

# Database
DB_TYPE=mysql
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
# Note: `OPENAI_MODEL` is the server default. The client can override it per request via the Model dropdown (sent as `model`).
# TLS / corporate proxy (optional)
# If you see: `SELF_SIGNED_CERT_IN_CHAIN` or `self-signed certificate in certificate chain`
# provide your corporate root CA certificate so the server can trust the proxy.
# Prefer one of these:
# OPENAI_TLS_CA_CERT_PATH=C:\\path\\to\\corp-root-ca.pem
# OPENAI_TLS_CA_CERT_BASE64=... (base64-encoded PEM)
# Dev mode default: SSL verification is skipped when running `npm run dev` (or `NODE_ENV=development`).
# To force SSL verification in dev, set:
# OPENAI_TLS_INSECURE=false
# To force skipping SSL in other modes (not recommended), set:
# OPENAI_TLS_INSECURE=true
# Optional TTS overrides
# OPENAI_TTS_MODEL=gpt-4o-mini-tts-2025-03-20
# OPENAI_TTS_VOICE=alloy
# Optional (defaults to server/src/prompts/chat.system.txt)
# OPENAI_SYSTEM_PROMPT_PATH=

# Optional chat history directory
# CHAT_HISTORY_DIR=server/data/chat-history
```

SQLite example:

```bash
# Database
DB_TYPE=sqlite
DB_SQLITE_PATH=server/data/sqlite/mimi_chat.sqlite
```

Note: SQLite mode uses TypeORM's `sqljs` driver (WASM) to avoid native build steps on Windows.

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

`db:sync` will also seed the default CEFR levels if they are missing or out of date.

Reset and recreate all tables (destructive, local only):

```bash
npm run db:reset
```

Seed default CEFR levels (A0–C2):

```bash
npm run db:seed:levels
```

The API server also auto-seeds the default levels on startup if missing.

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

## Chat editing (server-side)

The server supports editing existing chat messages via `POST /api/chat/edit`.

There are two edit modes:

### 1) Editing a user message (regenerates assistant reply)

When a user message is edited, the server:
- Finds the Nth user message (zero-based `userMessageIndex`) in the session history
- Truncates history from that user message onward
- Rebuilds the system prompt (level/story/context fields from the request body)
- Re-generates the assistant reply from that point
- Rewrites the session history file with the updated conversation

Request body:

```json
{
  "sessionId": "...",
  "kind": "user",
  "userMessageIndex": 0,
  "content": "edited user text",
  "storyId": 123,
  "model": "gpt-4.1-mini"
}
```

Notes:
- `userMessageIndex` counts only messages with `role === "user"` in that session (zero-based).
- `storyId` and `model` are optional. The server also accepts other optional prompt fields used by the system prompt builder.

### 2) Editing an assistant message (developer note only)

When an assistant message is edited, the server does **not** rewrite the assistant message in the history file.
Instead, it appends a `developer` note that records the edit, using the assistant turn's `MessageId`.

Request body:

```json
{
  "sessionId": "...",
  "kind": "assistant",
  "assistantMessageId": "msg-123",
  "content": "updated assistant text"
}
```

Developer note format:

```text
Assistant message edited: msg-123.
New content:
updated assistant text
```

How the edit is applied:
- `GET /api/chat/history` applies these developer edit notes in-memory before returning messages, so edited assistant text persists after reload.
- `POST /api/journals/end` also applies these developer edit notes before generating the journal summary and before persisting `messages` rows.

## Journals and message persistence

Chat messages are **not** saved to MySQL during the conversation. When the user ends a conversation, the server:
- Sends a developer instruction asking OpenAI to summarize the session
- Summary response is expected as JSON with `Summary` and `UpdatedStoryDescription` (Vietnamese text)
- Updates story progress from `UpdatedStoryDescription` when a story is attached
- Creates a Journal entry from the summary
- Persists all messages from the session history into the `messages` table
- Clears the session history file

## Characters in chat (developer messages)

Characters are not embedded into the system prompt. Instead, the client explicitly adds/removes characters for a chat session.
Those actions append a `developer` message to the session history.

The client can also append a free-form developer context message (stored in history as `role: developer`) to guide the assistant.
This is sent via `POST /api/chat/developer` with `kind: "context_update"`.

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
- `POST /api/chat/send` (expects `message` and `sessionId`; also accepts optional context fields and `model`)
- `GET /api/chat/history?sessionId=...`
- `GET /api/chat/developer-state?sessionId=...` (returns active character names)
- `POST /api/chat/developer` (append developer messages; kinds: `character_added`, `character_removed`, `context_update`)
- `POST /api/chat/edit` (edit messages: `kind: user` regenerates history; `kind: assistant` appends an edit developer note)

Journals:
- `POST /api/journals/end` (summarize current session and persist messages)
- `GET /api/journals` (list summaries)
- `GET /api/journals/:id` (journal + messages)
- `GET /api/journals/search?q=...` (search messages; used by the vocabulary memory editor)

Vocabulary (FSRS):
- `GET /api/vocabulary` (list vocabularies with review + memory)
- `GET /api/vocabulary/:id` (get a single vocabulary)
- `POST /api/vocabulary` (collect a vocabulary; supports optional `difficultyRating`, `memory`, `linkedMessageIds`)
- `PUT /api/vocabulary/:id` (update vocab text)
- `DELETE /api/vocabulary/:id` (delete vocab)
- `GET /api/vocabulary/due` (vocab due for review today)
- `POST /api/vocabulary/:id/review` (submit FSRS rating 1–4)
- `GET /api/vocabulary/stats` (counts: total, dueToday, starred, difficult)
- `PUT /api/vocabulary/:id/memory` (save memory content + linkedMessageIds)
- `PUT /api/vocabulary/:id/star` (toggle starred)
- `PUT /api/vocabulary/:id/direction` (set `kr-vn` or `vn-kr`)

Translation Drill:
- `GET /api/translation` (list translation cards with reviews)
- `GET /api/translation/due` (cards due for review today)
- `GET /api/translation/learn` (random new message not in translation cards)
- `POST /api/translation/explain` (AI grammar/vocab explanation in Markdown; cached per card)
- `POST /api/translation/review` (submit FSRS rating 1–4, creates card if needed; accepts `messageId` or `cardId` plus optional `userTranslation`)
- `PUT /api/translation/:id/star` (toggle starred)
- `GET /api/translation/stats` (counts: total, dueToday, starred, difficult)

Listening Drill:
- `GET /api/listening` (list listening cards with reviews)
- `GET /api/listening/due` (cards due for review today)
- `GET /api/listening/learn` (random new message with audio not in listening cards)
- `POST /api/listening/review` (submit FSRS rating 1–4, creates card if needed; accepts `messageId` or `cardId`)
- `PUT /api/listening/:id/star` (toggle starred)
- `GET /api/listening/stats` (counts: total, dueToday, starred, difficult)

Shadowing Drill:
- `GET /api/shadowing` (list shadowing cards with reviews)
- `GET /api/shadowing/due` (cards due for review today)
- `GET /api/shadowing/learn` (random new message with audio not in shadowing cards)
- `POST /api/shadowing/review` (submit FSRS rating 1–4, creates card if needed; accepts `messageId` or `cardId`, optional `userTranscript`)
- `PUT /api/shadowing/:id/star` (toggle starred)
- `POST /api/shadowing/transcribe` (audio data URL -> transcript)
- `GET /api/shadowing/stats` (counts: total, dueToday, starred, difficult)

Notes:
- Due/difficult calculations use the `Asia/Ho_Chi_Minh` day boundary.
- Translation cards store `userTranslation`, `audio`, and `explanationMd` fields for drill playback and explain caching.
- Difficult/Starred drill queues are handled locally (Hard moves to end, Easy removes) and do not update FSRS or persist to DB.

TTS:
- `GET /api/text-to-speech?text=...&tone=...&voice=...` (cached by MD5 of text+tone+voice)
  - `tone` defaults to `neutral, medium pitch` when omitted
  - `voice` is optional; when provided, it overrides `OPENAI_TTS_VOICE` for generation
  - `force=true` deletes any existing cached mp3 before regenerating

Chat response format:
- The assistant reply is a JSON array of objects with `MessageId`, `CharacterName`, `Text`, `Tone`, `Translation`.

Client notes:
- Chat model selection is stored in localStorage and sent with `/api/chat/send` as `model`.
- If the assistant returns multiple turns, the chat UI generates/plays TTS sequentially and only renders a message after its audio is ready.
- Journal audio playback applies per-character voiceName + pitch/speakingRate.

Characters:
- `GET /api/characters`
- `POST /api/characters/upload-avatar`
- `POST /api/characters`
- `PUT /api/characters/:id`
- `DELETE /api/characters/:id`

Static assets:
- `GET /public/...` (serves uploaded avatars from the server)
- `GET /audio/<hash>.mp3` (serves generated TTS audio)

## Stories
- `GET /api/stories`
- `GET /api/stories/:id`
- `POST /api/stories`
- `PUT /api/stories/:id`
- `DELETE /api/stories/:id`
