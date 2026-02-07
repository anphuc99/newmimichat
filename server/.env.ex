# Example environment variables for development
# Copy this file to .env and adjust values as needed.

# Database (MySQL) settings
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mimi_chat

# Server
PORT=4000

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
# Optional override for the system prompt file
# OPENAI_SYSTEM_PROMPT_PATH=src/prompts/chat.system.txt

# Auth
JWT_SECRET=change-me
REGISTRATION_TOKEN=change-me

# TypeORM / ORM options (optional)
# TYPEORM_SYNCHRONIZE=false
# TYPEORM_LOGGING=false

# Example MySQL connection (for reference):
# mysql://root:password@localhost:3306/mimi_chat
