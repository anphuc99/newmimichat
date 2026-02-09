import { useCallback, useEffect, useState } from "react";
import type { VocabularyItem, VocabularyMemory } from "../VocabularyView";
import { apiUrl } from "../../../lib/api";
import { authFetch } from "../../../lib/auth";

/** Message search result from the API. */
interface MessageSearchResult {
  messageId: string;
  journalId: number;
  journalDate: string;
  content: string;
  characterName: string;
  translation: string | null;
  tone: string | null;
  audio: string | null;
}

/** Linked message embedded in memory. */
interface LinkedMessage {
  messageId: string;
  content: string;
  characterName: string;
  journalDate: string;
}

interface VocabularyMemoryEditorProps {
  vocabulary: VocabularyItem;
  existingMemory?: VocabularyMemory | null;
  onSave: (userMemory: string, linkedMessageIds: string[]) => Promise<void>;
  onCancel: () => void;
}

/**
 * Parses memory content to extract linked message IDs and text.
 *
 * @param rawContent - Raw memory content with [MSG:id] markers.
 * @returns Object with plain text and linked message IDs.
 */
const parseMemoryContent = (rawContent: string): { text: string; linkedIds: string[] } => {
  const linkedIds: string[] = [];
  const msgRegex = /\[MSG:([^\]]+)\]/g;
  let match;

  while ((match = msgRegex.exec(rawContent)) !== null) {
    const id = match[1];
    if (id && !linkedIds.includes(id)) {
      linkedIds.push(id);
    }
  }

  // Remove [MSG:...] markers for display
  const text = rawContent.replace(msgRegex, "").trim();

  return { text, linkedIds };
};

/**
 * Serializes memory content with linked message IDs back to storage format.
 *
 * @param text - Plain text content.
 * @param linkedMessages - Array of linked messages.
 * @returns Serialized memory content.
 */
const serializeMemoryContent = (text: string, linkedMessages: LinkedMessage[]): string => {
  let content = text.trim();

  // Append linked message markers at the end
  for (const msg of linkedMessages) {
    content += `\n[MSG:${msg.messageId}]`;
  }

  return content.trim();
};

/**
 * Rich memory editor component for vocabulary items.
 * Allows adding text notes and linking messages from journals.
 *
 * @param props - Editor dependencies.
 * @returns The memory editor component.
 */
const VocabularyMemoryEditor = ({
  vocabulary,
  existingMemory,
  onSave,
  onCancel
}: VocabularyMemoryEditorProps) => {
  // Editor state
  const [memoryText, setMemoryText] = useState("");
  const [linkedMessages, setLinkedMessages] = useState<LinkedMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Initialize with existing memory
  useEffect(() => {
    if (existingMemory?.userMemory) {
      const { text, linkedIds } = parseMemoryContent(existingMemory.userMemory);
      setMemoryText(text);

      // Fetch linked message details
      if (linkedIds.length > 0) {
        void fetchLinkedMessages(linkedIds);
      }
    }
  }, [existingMemory]);

  /**
   * Fetches message details for linked IDs.
   */
  const fetchLinkedMessages = async (ids: string[]) => {
    // Search for each ID to get message details
    const messages: LinkedMessage[] = [];

    for (const id of ids) {
      try {
        const response = await authFetch(apiUrl(`/api/journal/search?q=${encodeURIComponent(id)}&limit=1`));
        if (response.ok) {
          const data = (await response.json()) as { results: MessageSearchResult[] };
          const result = data.results.find((r) => r.messageId === id);
          if (result) {
            messages.push({
              messageId: result.messageId,
              content: result.content,
              characterName: result.characterName,
              journalDate: result.journalDate
            });
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    setLinkedMessages(messages);
  };

  /**
   * Searches messages by query.
   */
  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim() || vocabulary.korean;
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await authFetch(
        apiUrl(`/api/journal/search?q=${encodeURIComponent(query)}&limit=50`)
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = (await response.json()) as { results: MessageSearchResult[] };
      setSearchResults(data.results);

      if (data.results.length === 0) {
        setSearchError(`Không tìm thấy "${query}" trong lịch sử hội thoại.`);
      }
    } catch (caught) {
      console.error("Search error:", caught);
      setSearchError("Lỗi khi tìm kiếm. Vui lòng thử lại.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, vocabulary.korean]);

  /**
   * Adds a message to linked messages.
   */
  const handleLinkMessage = (result: MessageSearchResult) => {
    // Check if already linked
    if (linkedMessages.some((m) => m.messageId === result.messageId)) {
      return;
    }

    setLinkedMessages((prev) => [
      ...prev,
      {
        messageId: result.messageId,
        content: result.content,
        characterName: result.characterName,
        journalDate: result.journalDate
      }
    ]);
  };

  /**
   * Removes a linked message.
   */
  const handleUnlinkMessage = (messageId: string) => {
    setLinkedMessages((prev) => prev.filter((m) => m.messageId !== messageId));
  };

  /**
   * Saves the memory.
   */
  const handleSave = async () => {
    const content = serializeMemoryContent(memoryText, linkedMessages);
    const linkedIds = linkedMessages.map((m) => m.messageId);

    if (!content && linkedIds.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(content, linkedIds);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if a message is already linked
  const isLinked = (messageId: string) =>
    linkedMessages.some((m) => m.messageId === messageId);

  return (
    <div className="vocab-memory-editor">
      {/* Header */}
      <header className="vocab-memory-editor__header">
        <h3>📝 {existingMemory ? "Chỉnh sửa" : "Tạo"} ký ức</h3>
        <div className="vocab-memory-editor__vocab-badge">
          <span className="vocab-memory-editor__korean">{vocabulary.korean}</span>
          <span className="vocab-memory-editor__vietnamese">{vocabulary.vietnamese}</span>
        </div>
        <button
          type="button"
          className="vocab-memory-editor__close-btn"
          onClick={onCancel}
        >
          ✕
        </button>
      </header>

      {/* Main content */}
      <div className="vocab-memory-editor__main">
        {/* Editor section */}
        <div className="vocab-memory-editor__editor-section">
          <label className="vocab-memory-editor__label">💭 Ký ức của bạn</label>
          <textarea
            className="vocab-memory-editor__textarea"
            placeholder="Viết ký ức của bạn với từ này..."
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            rows={6}
          />

          {/* Linked messages */}
          {linkedMessages.length > 0 && (
            <div className="vocab-memory-editor__linked-section">
              <label className="vocab-memory-editor__label">
                🔗 Tin nhắn đã liên kết ({linkedMessages.length})
              </label>
              <ul className="vocab-memory-editor__linked-list">
                {linkedMessages.map((msg) => (
                  <li key={msg.messageId} className="vocab-memory-editor__linked-item">
                    <div className="vocab-memory-editor__linked-meta">
                      <span className="vocab-memory-editor__linked-char">
                        👤 {msg.characterName}
                      </span>
                      <span className="vocab-memory-editor__linked-date">
                        📅 {new Date(msg.journalDate).toLocaleDateString("vi-VN")}
                      </span>
                      <button
                        type="button"
                        className="vocab-memory-editor__unlink-btn"
                        onClick={() => handleUnlinkMessage(msg.messageId)}
                        title="Bỏ liên kết"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="vocab-memory-editor__linked-content">{msg.content}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="vocab-memory-editor__tip">
            💡 Tìm tin nhắn bên phải để thêm ngữ cảnh cho từ vựng
          </p>
        </div>

        {/* Search section */}
        <div className="vocab-memory-editor__search-section">
          <h4 className="vocab-memory-editor__search-title">🔍 Tìm tin nhắn liên quan</h4>

          <div className="vocab-memory-editor__search-box">
            <input
              type="text"
              className="vocab-memory-editor__search-input"
              placeholder={`Tìm "${vocabulary.korean}" hoặc nhập từ khác...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            />
            <button
              type="button"
              className="vocab-memory-editor__search-btn"
              onClick={() => void handleSearch()}
              disabled={isSearching}
            >
              {isSearching ? "..." : "🔍"}
            </button>
          </div>

          {/* AI search button */}
          {!hasSearched && (
            <button
              type="button"
              className="vocab-memory-editor__ai-search-btn"
              onClick={() => void handleSearch()}
              disabled={isSearching}
            >
              {isSearching ? "⏳ Đang tìm..." : `🤖 Tìm "${vocabulary.korean}"`}
            </button>
          )}

          {/* Search error */}
          {searchError && (
            <div className="vocab-memory-editor__search-error">⚠️ {searchError}</div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="vocab-memory-editor__results">
              <div className="vocab-memory-editor__results-header">
                📝 {searchResults.length} kết quả
              </div>
              <ul className="vocab-memory-editor__results-list">
                {searchResults.map((result) => (
                  <li
                    key={result.messageId}
                    className={`vocab-memory-editor__result-item ${
                      isLinked(result.messageId) ? "vocab-memory-editor__result-item--linked" : ""
                    }`}
                  >
                    <div className="vocab-memory-editor__result-meta">
                      <span className="vocab-memory-editor__result-char">
                        👤 {result.characterName}
                      </span>
                      <span className="vocab-memory-editor__result-date">
                        📅 {new Date(result.journalDate).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <p className="vocab-memory-editor__result-content">{result.content}</p>
                    {result.translation && (
                      <p className="vocab-memory-editor__result-translation">
                        {result.translation}
                      </p>
                    )}
                    <button
                      type="button"
                      className="vocab-memory-editor__link-btn"
                      onClick={() => handleLinkMessage(result)}
                      disabled={isLinked(result.messageId)}
                    >
                      {isLinked(result.messageId) ? "✓ Đã liên kết" : "+ Liên kết"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No results */}
          {hasSearched && searchResults.length === 0 && !searchError && !isSearching && (
            <div className="vocab-memory-editor__no-results">
              <p>Không tìm thấy kết quả.</p>
              <p>Thử tìm với từ khác hoặc regex.</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <footer className="vocab-memory-editor__actions">
        <button
          type="button"
          className="vocab-memory-editor__cancel-btn"
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          type="button"
          className="vocab-memory-editor__save-btn"
          onClick={() => void handleSave()}
          disabled={isSaving || (!memoryText.trim() && linkedMessages.length === 0)}
        >
          {isSaving ? "⏳ Đang lưu..." : "💾 Lưu ký ức"}
        </button>
      </footer>
    </div>
  );
};

export default VocabularyMemoryEditor;
