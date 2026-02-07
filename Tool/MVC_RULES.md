# MVC Rules

## Overview

- View lives in client under client/src/views/<group>.
- Controller and Model live in server under server/src/controllers/<group> and server/src/models.
- Each controller handles exactly one view group.
- Each view group has one main view and optional child views.
- Child views receive dependencies via props from the main view.
- Each controller must have a UnitTest outside server/client.

## View Group Structure

client/src/views/<group>/
- <Group>View.tsx (main view)
- components/
  - <Child>.tsx (child views)
- index.ts (exports main view)

## Server Structure

server/src/controllers/<group>/
- <group>.controller.ts

server/src/routes/
- <group>.routes.ts

server/src/models/
- <Entity>.entity.ts

## Data Access

- Models use TypeORM with MySQL.
- Configure database connection via environment variables:
  - DB_HOST
  - DB_PORT
  - DB_USER
  - DB_PASSWORD
  - DB_NAME

## Routing

- Each view group gets a dedicated route file.
- Register all group routes in server/src/routes/index.ts using the mvc-gen markers.

## Dependency Injection (Client)

- Main view fetches data and prepares dependencies.
- Child views only receive data and callbacks via props.
- Avoid fetching data directly inside child views.

## Generator Tool

Use the generator to scaffold a new MVC group:

- npm run mvc:gen -- --group <name> [--view <ViewName>] [--entity <EntityName>] [--child <ChildName>] [--force]

Notes:
- --force overwrites existing files.
- The generator inserts routes using the mvc-gen markers in server/src/routes/index.ts.

## Unit Tests (Mandatory)

- All unit tests live under tests/ (outside client/ and server/).
- Each controller requires at least one test file:
  - tests/server/controllers/<group>/<group>.controller.test.ts
- The work is considered complete only when all tests pass:
  - npm test
