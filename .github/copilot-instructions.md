# Copilot / AI Coding Instructions

## 🔴 Mandatory Context Reading

**Before writing, modifying, or suggesting any code:**

1. **MUST read `README.md` and `WORK_PLAN.md` first**
   - Project purpose
   - Folder structure
   - Architecture & design decisions
   - Coding conventions

2. If a request involves a specific file:
   - **MUST read the latest version of that file before editing**
   - Cached or outdated context is forbidden

3. **DO NOT assume anything**
   - If context is missing, request the file
   - Guessing behavior or structure is prohibited

---

## 🧠 Code Change Rules

Whenever you write or modify code:

1. **Always work on the latest content**
   - Re-read files before applying changes

2. **Preserve existing architecture**
   - Follow current patterns and conventions
   - No new paradigms unless explicitly requested

3. **Minimal & focused changes**
   - Change only what is required
   - Do not refactor unrelated code

4. **Absolute image URLs only**
   - All `img` tags must use absolute URLs (no relative paths)

---

## 📘 Documentation Requirements

All code changes MUST include documentation:

### Inline Comments
- Explain complex logic
- Clarify non-obvious decisions

### Function / Class Documentation
- Use **JSDoc / TSDoc** or language-equivalent
- Must describe:
  - Purpose
  - Parameters
  - Return values
  - Side effects (if any)

### README.md Updates
Required for **major changes**, including:
- New features
- New scripts or commands
- New configuration or setup steps
- Architecture or workflow changes

---

## 🧪 Syntax & Build Validation (MANDATORY)

**Code generation MUST NOT finish unless syntax is valid.**

Before ending any response that includes code, the AI MUST:

1. **Ensure zero syntax errors**
   - No missing brackets, parentheses, or semicolons
   - No invalid keywords or malformed declarations

2. **Mentally validate compilation / parsing**
   - Code must be parsable by the target language compiler/interpreter
   - Type annotations and generics must be valid

3. **Fix syntax errors immediately**
   - If an error is detected, it MUST be corrected before continuing
   - The AI is forbidden from leaving known syntax errors unresolved

4. **If syntax cannot be guaranteed**
   - The AI MUST explicitly state the risk
   - AND ask for clarification instead of guessing

❌ **Never output code with known syntax errors**

---

## ✅ Unit Tests (MANDATORY)

Whenever a controller is created or modified:

1. **MUST add/update a UnitTest**
   - Tests live outside `server/` and `client/` under `tests/`
   - Path convention:
     - `tests/server/controllers/<group>/<group>.controller.test.ts`

2. **MUST run all tests and ensure they pass**
   - Run: `npm test`
   - The AI must not stop until tests pass.

---

## 🔒 Mandatory Git Commit (NON-NEGOTIABLE)

**AFTER EVERY CODE GENERATION OR MODIFICATION:**

1. **MUST create a Git commit**
   - No exceptions
   - No uncommitted changes
   - No mixing unrelated work

2. **Commit MUST include**
   - All modified and newly created files
   - Documentation updates when applicable

3. **Commit message MUST be explicit**
   - Clearly state **WHAT** was changed
   - Clearly state **WHY** it was changed
   - Mention affected modules or files

### Required Commit Message Format

**Details:**
   - What was changed
   - Why it was changed
   - Key files affected


#### Allowed `<type>` values
- `feat` — new feature
- `fix` — bug fix
- `refactor` — restructuring without behavior change
- `docs` — documentation only
- `chore` — tooling or maintenance
- `test` — tests only

#### Forbidden Commit Messages
- `update`
- `fix`
- `misc`
- `change code`
- Empty or vague messages

---

## 🚫 Strict Prohibitions

- ❌ Do NOT generate code before reading `README.md` and `WORK_PLAN.md`
- ❌ Do NOT guess project structure or logic
- ❌ Do NOT skip Git commit
- ❌ Do NOT end with syntax errors
- ❌ Do NOT mix unrelated changes
- ❌ Do NOT remove existing documentation unless explicitly requested

---

## ✅ Expected Behavior

- Ask for missing files when context is insufficient
- Follow existing style and conventions
- Prefer clarity over cleverness
- Every code change must be documented, validated, and traceable
- **No syntax errors are allowed at completion please check carefully server and client**
- **Every request ends with a Git commit**
