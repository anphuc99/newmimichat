# New Mimi Chat (Full Stack)

Full-stack MimiChat refactor: React (Vite) client + Express (TypeScript) server + MySQL (TypeORM) + OpenAI/Gemini chat.

Core features implemented so far:
- JWT auth (register/login) + signup gated by a `REGISTRATION_TOKEN`
- CEFR levels A0–C2 stored in DB (seeded via `npm run db:sync` / `npm run db:seed:levels`) + user can select their level
- Characters CRUD, avatar upload (served under `/public`), optional voiceName selection + per-character pitch/speakingRate
- Chat endpoint backed by OpenAI or Gemini (switchable via model selector)
- Multi-model support: OpenAI (gpt-4o, gpt-4.1, gpt-5, etc.) and Gemini (gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3-pro-preview)
- OpenAI TTS playback with cached audio (hash includes text + tone + voice)
- Journal summaries + message persistence on conversation end
- Vocabulary collection + FSRS spaced repetition (Due/Learn/Difficult/Starred)
- Vocabulary memories: rich-text notes with linked messages via `[MSG:<messageId>]` markers (and optional `[IMG:<url>]`)
- Translation drill with FSRS scheduling (Due/Learn/Difficult/Starred)
- Translation drill AI explanations (cached Markdown) + saved learner translations
- Translation drill audio playback (reuses chat TTS audio, applies character pitch/speakingRate)
- Listening drill with FSRS scheduling (Due/Learn/Difficult/Starred)
- Shadowing drill with FSRS scheduling + OpenAI `gpt-4o-transcribe` scoring
- Daily task checklist for translation, listening, and shadowing goals
- Streak tracking that increments when all daily tasks are completed
- Stories (user-created) with description + current progress, linked to journals
- File-backed chat history (JSONL stored in `.txt`) scoped by `sessionId`
- System instruction stored in history (for stable prompting / caching)
- Character context injected via per-session **developer messages** (add/remove)
- Gemini-compatible developer role handling (automatically converted for Gemini API)

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

# Gemini (Google AI)
# GOOGLE_API_KEY=replace_me
# GEMINI_MODEL=gemini-2.5-flash
# Note: Gemini models available: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3-pro-preview
# The client can select between OpenAI and Gemini models via the Model dropdown.
# Developer role messages are automatically converted for Gemini compatibility.

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

Note: the API server does not currently auto-seed levels on startup. Use `db:sync` (local) or `db:seed:levels`.

## Migration from Old MimiChat

To migrate data from the old MimiChat (JSON-based storage) to the new system (MySQL/SQLite):

```bash
npm run migrate:old -- --source <path-to-old-server-data>
```

Positional argument is also supported:

```bash
npm run migrate:old -- <path-to-old-server-data>
```

Example:

```bash
npm run migrate:old -- --source D:/Unity/mimichat/server/data
```

This migrates:
- **Stories** (from `stories-index.json` + `stories/*.json`)
- **Vocabularies** and FSRS review schedules
- **Vocabulary memories** (user notes linked to messages)
- **Characters** (profiles, voice settings)
- **Journals** and chat messages
- **Translation cards** and reviews
- **Streak** data

**Notes:**
- Since the old code has no user system, all records are assigned `userId = 1`.
- The script ensures a default user exists for `userId = 1`. If missing, it creates:
  - `username: migrated_user`
  - `password: migrated_user_password`

The migration is **idempotent** - running it multiple times will skip already-imported records.

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

## Password reset (registration token)

Reset a user password using the registration token (no old password required):

```bash
POST /api/users/reset-password
{
  "username": "mimi",
  "newPassword": "newpass123",
  "registerToken": "<REGISTRATION_TOKEN>"
}
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
- `POST /api/users/reset-password` (requires `registerToken`; resets without old password)
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

Tasks:
- `GET /api/tasks/today` (daily checklist progress for vocab/translation/listening/shadowing)

Tasks response shape:

```json
{
  "date": "2026-02-10",
  "tasks": [
    {
      "id": "vocab_new",
      "label": "Học 20 từ mới",
      "type": "count",
      "progress": 3,
      "target": 20,
      "remaining": 17,
      "completed": false
    }
  ],
  "completedCount": 1,
  "totalCount": 8
}
```

Streak update behavior:
- The server updates the streak automatically when *all* tasks are completed for the day.
- This update happens during `GET /api/tasks/today` (not via a separate “complete task” endpoint).

Streak:
- `GET /api/streak` (current streak status; resets current streak to 0 if a day is missed)

Streak response shape:

```json
{
  "currentStreak": 2,
  "longestStreak": 7,
  "lastCompletedDate": "2026-02-10T12:34:56.000Z"
}
```

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

Shadowing transcription payload:

```json
{
  "audio": "data:audio/webm;codecs=opus;base64,...."
}
```

Notes:
- `audio` must be a base64 data URL (`data:audio/<type>[;...];base64,<data>`). `;codecs=...` is accepted.
- Response is `{ "transcript": "..." }`.

## Server internals (new helpers)

These are not HTTP APIs, but are useful entry points when extending the server:

- OpenAI:
  - `createOpenAIClient(apiKey, options)` and `createOpenAIChatService(config)` (TLS override support via `OPENAI_TLS_*` env)
- Prompting:
  - `buildChatSystemPrompt(params)` (includes the JSON contract for end-of-session summaries)
- Seeding:
  - `seedDefaultLevels(dataSource)` (used by `npm run db:sync` and `npm run db:seed:levels`)
- Migration:
  - `runMigration(sourcePath)` + CLI parsing supports `--source <path>` or positional `<path>`

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
