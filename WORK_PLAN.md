# Work Plan: Refactor MimiChat cũ → MimiChat mới (MVC + OpenAI + MySQL)

## 1) Mục tiêu
- Refactor MimiChat cũ (code/UI lộn xộn, lưu JSON, client gọi AI trực tiếp) sang MimiChat mới theo kiến trúc **Fullstack MVC** dễ bảo trì.
- **Không dùng Gemini**. Dùng **OpenAI**.
- **Client không kết nối trực tiếp AI**: mọi request AI đi qua **Server**.
- Chuyển persistence từ **JSON file** sang **MySQL** (TypeORM).

## 2) Phạm vi tính năng (Scope)

### 2.1 Giữ lại (MVP cho MimiChat mới)
1. **Chat** (public + private nếu đang dùng)
2. **Xem nhật ký (Journal)**
3. **Ký ức (Memory)** (gắn với vocabulary / message)
4. **Vocabulary (FSRS spaced repetition)**
5. **Luyện dịch (Translation Drill)**
6. **Streak**
7. **Nhiệm vụ (Daily tasks / Tasks)**
8. **Quản lý nhân vật (Character Manager)**

### 2.2 Loại bỏ / để sau
- Tất cả tính năng UI/scene/modal khác không nằm trong danh sách trên sẽ **bỏ qua hoặc thêm sau**.
- TTS/Audio: nếu đang tồn tại, quyết định giữ hay bỏ sẽ được chốt ở bước “Audit” (mục 4.1). Không đưa vào MVP nếu không bắt buộc.

## 3) Nguyên tắc kiến trúc & coding conventions

### 3.1 MVC theo chuẩn dự án mới
Theo [Tool/MVC_RULES.md](Tool/MVC_RULES.md):
- **View group**: `client/src/views/<group>/...`
- **Controller**: `server/src/controllers/<group>/<group>.controller.ts`
- **Routes**: `server/src/routes/<group>.routes.ts` và đăng ký trong `server/src/routes/index.ts`
- **Model/Entity**: `server/src/models/*.entity.ts`
- **Unit test bắt buộc** cho mỗi controller: `tests/server/controllers/<group>/<group>.controller.test.ts`

Khuyến nghị nhóm MVC tương ứng với các feature cần giữ:
- `chat`
- `journal`
- `vocabulary`
- `memory`
- `translation`
- `streak`
- `tasks`
- `characters`
- `shared` (health, utils dùng chung)

### 3.2 Ràng buộc quan trọng
- **Không hard-code OpenAI key ở client**.
- API key chỉ tồn tại trên server qua env (ví dụ `OPENAI_API_KEY`).
- UI tối ưu theo hướng **ít màn hình, ít state chồng chéo**, tách view group rõ ràng; tránh “siêu component” kiểu `App.tsx` 3000+ lines.

## 4) Lộ trình triển khai (theo phase)

> Mục tiêu là đi từ “xác định đúng dữ liệu + API contract” → “đi được end-to-end” → “migrate dữ liệu” → “tối ưu UI”.

### 4.1 Phase 0 — Audit & chốt phạm vi (1–2 ngày)
Deliverables:
- Danh sách màn hình/luồng người dùng cần có cho 7 tính năng giữ lại.
- Mapping tính năng cũ → module mới.
- Quyết định các điểm còn mơ hồ (không đoán):
  - Có cần **đăng nhập/JWT** không? (MimiChat cũ có JWT, MimiChat mới starter hiện chưa có.)
  - Có cần **audio/TTS** trong MVP không?
  - Chat cần **streaming** (SSE) hay chỉ request/response?

Việc cần làm:
- Đọc/đánh dấu các nguồn dữ liệu JSON cũ:
  - `server/data/streak.json`
  - `server/data/vocabulary-store.json` (vocab + reviews + memories + progress)
  - `server/data/translation-store.json`
  - `server/data/...` liên quan journal/messages/characters/tasks
- Chốt “nguồn sự thật” (source-of-truth) cho từng loại dữ liệu để thiết kế DB.

### 4.2 Phase 1 — Thiết kế MySQL schema + migration strategy (2–4 ngày)

#### 4.2.1 Thiết kế schema (đề xuất)
Dưới đây là đề xuất theo type hiện có (từ `mimichat/types.ts`). Chi tiết sẽ được chốt sau Audit.

**Core**
- `users` (tùy chọn nếu cần multi-user)
- `characters`
- `conversations` (public/private, optional `private_with_character_id`)
- `messages` (text, sender, character_id nullable, translation, raw_text, kind, timestamps)
- `daily_chats` / `journals` (tương ứng `DailyChat`: date, summary)
- `daily_chat_messages` (join để gắn messages vào daily chat theo thứ tự)

**Vocabulary / Memory / FSRS**
- `vocabularies` (korean, vietnamese, story_id?, daily_chat_id?, created_date, manually_added)
- `vocabulary_reviews` (FSRS fields: stability, difficulty, lapses, next_review_date, last_review_date, card_direction, is_starred)
- `vocabulary_review_history` (mỗi lần review: rating, stability_before/after, difficulty_before/after, retrievability, timestamps)
- `vocabulary_memories` (userMemory, linkedMessageIds → normalized join table)
- `vocabulary_memory_message_links` (memory_id, message_id)
- `vocabulary_progress` (correct/incorrect counts, last_practiced, needs_review, attempts)

**Translation Drill**
- `translation_cards` (message_id, text, translation, metadata: story/daily_chat/character)
- `translation_reviews` + `translation_review_history` (có thể tái dùng bảng review chung bằng polymorphic key hoặc tách bảng)

**Streak / Tasks**
- `streaks` (current_streak, longest_streak, last_activity_date)
- `tasks` (định nghĩa task)
- `task_completions` (user_id?, date, status)

Lưu ý kỹ thuật:
- Project mới đang `synchronize: false` trong TypeORM → cần kế hoạch migrations (TypeORM migration hoặc script tạo bảng).

#### 4.2.2 Chiến lược migration JSON → MySQL
- Viết script migrate chạy 1 lần (ví dụ `server/src/scripts/migrate-json-to-mysql.ts`).
- Nguyên tắc:
  - Preserve `id` từ JSON khi có thể (UUID/string IDs) để tránh mapping phức tạp.
  - Với dữ liệu “embedded arrays” (vd `reviewHistory`, `linkedMessageIds`), tách thành bảng con/join.
  - Có cơ chế **idempotent** (chạy lại không tạo trùng) bằng unique keys.
- Output migration:
  - Báo cáo tổng số record import theo table.
  - Danh sách lỗi record (nếu có) để xử lý thủ công.

### 4.3 Phase 2 — Thiết kế API contract & scaffolding MVC groups (2–3 ngày)

#### 4.3.1 API endpoints tối thiểu
- `POST /api/chat/send` → server gọi OpenAI, lưu message, trả response
- `GET /api/chat/history?conversationId=...` → tải lịch sử chat
- `GET /api/journal/days` + `GET /api/journal/:dayId`
- `GET/POST /api/memory/...` (CRUD ký ức)
- `GET/POST /api/translation/...` (cards + review)
- `GET/POST /api/streak/...`
- `GET/POST /api/tasks/...`
- `GET/POST /api/characters/...` (CRUD + relations/voice settings nếu cần)

#### 4.3.2 Scaffolding theo generator
- Dùng `npm run mvc:gen -- --group <name>` cho từng group.
- Với mỗi controller tạo/đổi: thêm unit test tương ứng trong `tests/` và chạy `npm test`.

### 4.4 Phase 3 — OpenAI integration (Server-side) (2–4 ngày)

#### 4.4.1 Thiết kế lớp dịch vụ OpenAI
- Tạo service server-side (ví dụ `server/src/services/openai.service.ts`) chịu trách nhiệm:
  - Build prompt/system prompt
  - Gọi OpenAI Chat Completions / Responses API
  - (Optional) streaming
  - Chuẩn hóa output (text, tool calls nếu có)

#### 4.4.2 Bảo mật & vận hành
- Env:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (mặc định chọn 1 model phù hợp chi phí/latency)
- Rate limit theo IP/user (nếu cần).
- Logging tối thiểu (không log prompt nhạy cảm nếu không cần).

### 4.5 Phase 4 — Xây lại UI theo view groups (3–7 ngày)

Mục tiêu: UI “gọn – đúng feature – dễ đọc”.

#### 4.5.1 Nguyên tắc UI
- Mỗi feature là 1 view group.
- State nằm ở main view; child components chỉ nhận props (theo MVC_RULES).
- Loại bỏ modal/scene rối rắm không thuộc scope.

#### 4.5.2 Kế hoạch UI theo module giữ lại
- `ChatView`: danh sách tin nhắn, input, chọn nhân vật, chọn public/private.
- `JournalView`: danh sách ngày, xem chi tiết ngày, filter tối thiểu (nếu có).
- `MemoryView`: danh sách ký ức theo vocab, editor đơn giản.
- `TranslationView`: danh sách thẻ dịch, flow luyện tập.
- `StreakView`: hiển thị streak + lịch sử (nếu có).
- `TasksView`: danh sách nhiệm vụ ngày + tick hoàn thành.
- `CharactersView`: CRUD nhân vật + quan hệ cơ bản.

Lưu ý: UI framework hiện của NewMimiChat là tối giản; nếu cần Tailwind/layout thì dùng đúng tokens/style hiện có (không tự chế theme mới).

### 4.6 Phase 5 — Kết nối end-to-end + dữ liệu thật + migration (3–7 ngày)
- Bật DB MySQL local, tạo bảng/migration.
- Chạy migrate JSON → MySQL.
- Sửa API để đọc/ghi DB thay vì mock.
- Verify các màn hình chạy được với dữ liệu sau migrate.

### 4.7 Phase 6 — Hardening (2–5 ngày)
- Dọn code: tách module, giảm trùng lặp, chuẩn hóa types.
- Thêm test cho các controller quan trọng.
- Kiểm tra performance: phân trang cho message/journal nếu dữ liệu lớn.
- Kiểm tra lỗi edge cases (null/undefined fields từ data cũ).

## 5) Mapping dữ liệu cũ → dữ liệu mới (tóm tắt)

### 5.1 Streak
- JSON: `currentStreak`, `longestStreak`, `lastActivityDate`
- DB: 1 record theo user (hoặc global nếu single-user)

### 5.2 Vocabulary store
Nguồn: `vocabulary-store.json` (rất lớn)
- `vocabularies[]` → bảng `vocabularies`
- `reviews[]` + `reviewHistory[]` → `vocabulary_reviews` + `vocabulary_review_history`
- `memories[]` + `linkedMessageIds[]` → `vocabulary_memories` + join table
- `progress{}` → `vocabulary_progress`

### 5.3 Translation store
Nguồn: `translation-store.json`
- `cards[]` → `translation_cards`
- `reviews[]` → `translation_reviews` (+ history nếu cần)

### 5.4 Journal / DailyChat / Messages
Nguồn: theo `DailyChat` trong type (`ChatJournal`)
- `dailyChats[]` → `daily_chats`
- `messages[]` → `messages`
- quan hệ dailyChat-message → join table để giữ thứ tự

## 6) Tiêu chí hoàn thành (Definition of Done)
- Client không chứa API key; mọi AI request đi qua server.
- Chat/Journals/Memories/Translation/Streak/Tasks/Characters hoạt động end-to-end.
- Dữ liệu được lưu & đọc từ MySQL (không còn JSON persistence cho các tính năng trong scope).
- Mỗi controller có unit test tương ứng; chạy `npm test` pass.

## 7) Rủi ro & cách giảm
- **Dữ liệu JSON lớn** (vd `vocabulary-store.json` ~ rất nhiều dòng): migrate cần chunking/batch insert.
- **Thiếu chuẩn auth**: nếu cần multi-user sẽ tăng scope. Giải pháp: chốt sớm ở Phase 0.
- **UI scope creep**: kiên quyết chỉ giữ 7 tính năng.

## 8) Câu hỏi cần chốt (để không đoán)
1. MimiChat mới có cần **đăng nhập/JWT** ngay không, hay single-user local trước?
2. Chat có cần **streaming** token (SSE) hay trả kết quả 1 lần?
3. Có giữ **TTS/audio** trong MVP không?
4. Các “Nhiệm vụ” hiện đang là CSV/JSON nào? Muốn giữ cấu trúc cũ hay thiết kế mới?
