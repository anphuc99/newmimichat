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
# OPENAI_SYSTEM_PROMPT_PATH=server/src/prompts/chat.system.txt

# OpenAI TLS / corporate proxy (optional)
# Provide a custom CA bundle if your network injects a self-signed certificate.
# OPENAI_TLS_CA_CERT_PATH=C:\\path\\to\\corp-root-ca.pem
# OPENAI_TLS_CA_CERT_BASE64=
# Dev mode default: TLS verification is skipped.
# Set false to force strict TLS in dev:
# OPENAI_TLS_INSECURE=false

# Auth
JWT_SECRET=change-me
