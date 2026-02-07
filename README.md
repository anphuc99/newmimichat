# New Mimi Chat (Full Stack)

React + Node.js (TypeScript) starter with a Vite client and Express server.

## Requirements

- Node.js 18+ (recommended)
- npm 9+

## Install

```bash
npm install
```

## Development

Runs both the server and client concurrently:

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000

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

Run all unit tests (tests live outside client/server):

```bash
npm test
```

## Project Structure

- client: React (Vite) app
- server: Express API server
- Tool: MVC scaffolding scripts

## MVC Structure

- View: client/src/views/<group>
- Controller: server/src/controllers/<group>
- Model: server/src/models

Rules and generator details: Tool/MVC_RULES.md

### MVC Generator

Scaffold a new view group with controller/model:

```bash
npm run mvc:gen -- --group home
```

Optional flags:
- --view <ViewName>
- --entity <EntityName>
- --child <ChildName>
- --force

## Database (MySQL + TypeORM)

Set environment variables before starting the server:

- DB_HOST (default: localhost)
- DB_PORT (default: 3306)
- DB_USER (default: root)
- DB_PASSWORD (default: empty)
- DB_NAME (default: mimi_chat)

## OpenAI

Set the following environment variables before starting the server:

- OPENAI_API_KEY
- OPENAI_MODEL (default: gpt-4o-mini)
- OPENAI_SYSTEM_PROMPT_PATH (optional)

## API

- GET /api/health
- GET /api/home/message
- POST /api/chat/send
- GET /api/characters
- POST /api/characters
- PUT /api/characters/:id
- DELETE /api/characters/:id
