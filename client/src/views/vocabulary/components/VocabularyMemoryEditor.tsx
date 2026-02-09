import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";
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

/** Linked message attrs for TipTap node. */
interface LinkedMessageAttrs {
  messageId: string;
  text: string;
  characterName: string;
  date: string;
  audioData?: string | null;
}

interface VocabularyMemoryEditorProps {
  vocabulary: VocabularyItem;
  existingMemory?: VocabularyMemory | null;
  onSave: (userMemory: string, linkedMessageIds: string[]) => Promise<void>;
  onCancel: () => void;
}

/**
 * Custom TipTap Message Block component.
 * Displays a draggable message block with character info.
 */
const MessageBlockComponent = ({ node, deleteNode }: { node: { attrs: Partial<LinkedMessageAttrs> }; deleteNode: () => void }) => {
  const { text, characterName, date } = node.attrs;

  return (
    <NodeViewWrapper className="message-node-wrapper" data-type="message-block" draggable="true" data-drag-handle>
      <div className="vocab-memory-editor__message-block" contentEditable={false}>
        <div className="vocab-memory-editor__message-header">
          <div className="vocab-memory-editor__drag-handle" data-drag-handle>⋮⋮</div>
          <span className="vocab-memory-editor__char-badge">👤 {characterName}</span>
          <span className="vocab-memory-editor__date-badge">📅 {date}</span>
          <button
            type="button"
            className="vocab-memory-editor__remove-msg-btn"
            onClick={deleteNode}
            title="Xóa tin nhắn"
          >
            ✕
          </button>
        </div>
        <div className="vocab-memory-editor__message-text">{text}</div>
      </div>
    </NodeViewWrapper>
  );
};

/**
 * Creates custom TipTap node for message blocks.
 */
const createMessageBlockExtension = () => {
  return Node.create({
    name: "messageBlock",
    group: "block",
    atom: true,
    draggable: true,

    addAttributes() {
      return {
        messageId: { default: "" },
        text: { default: "" },
        characterName: { default: "" },
        date: { default: "" },
        audioData: { default: null }
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="message-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-type": "message-block" })];
    },

    addNodeView() {
      return ReactNodeViewRenderer(MessageBlockComponent);
    }
  });
};

/**
 * Parses saved memory to TipTap JSON format.
 *
 * @param userMemory - Raw memory text.
 * @param linkedMessagesMap - Map of message ID to linked message attrs.
 * @returns TipTap document JSON.
 */
const parseMemoryToTipTap = (
  userMemory: string,
  linkedMessagesMap: Map<string, LinkedMessageAttrs>
): JSONContent => {
  const content: JSONContent[] = [];
  const regex = /\[MSG:([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(userMemory)) !== null) {
    if (match.index > lastIndex) {
      const textContent = userMemory.slice(lastIndex, match.index).trim();
      if (textContent) {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: textContent }]
        });
      }
    }

    const msgId = match[1];
    const linkedMsg = linkedMessagesMap.get(msgId);
    if (linkedMsg) {
      content.push({
        type: "messageBlock",
        attrs: linkedMsg
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < userMemory.length) {
    const textContent = userMemory.slice(lastIndex).trim();
    if (textContent) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: textContent }]
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
};

/**
 * Serializes TipTap content back to storage format.
 *
 * @param json - TipTap JSON document.
 * @returns Object with text and message IDs.
 */
const serializeTipTapContent = (json: JSONContent): { text: string; messageIds: string[] } => {
  let text = "";
  const messageIds: string[] = [];

  if (!json?.content) return { text: "", messageIds: [] };

  for (const node of json.content) {
    if (node.type === "paragraph") {
      const paragraphText = node.content?.map((n) => n.text || "").join("") || "";
      if (paragraphText) {
        text += (text ? "\n" : "") + paragraphText;
      }
    } else if (node.type === "messageBlock") {
      const msgId = node.attrs?.messageId as string | undefined;
      if (msgId) {
        text += `[MSG:${msgId}]`;
        if (!messageIds.includes(msgId)) {
          messageIds.push(msgId);
        }
      }
    }
  }

  return { text, messageIds };
};

/**
 * Detects if running on mobile.
 */
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Extracts linked message IDs from raw memory content.
 *
 * @param rawContent - Raw memory with [MSG:id] markers.
 * @returns Array of message IDs.
 */
const extractLinkedIds = (rawContent: string): string[] => {
  const ids: string[] = [];
  const msgRegex = /\[MSG:([^\]]+)\]/g;
  let match;
  while ((match = msgRegex.exec(rawContent)) !== null) {
    const id = match[1];
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
};

/**
 * Rich memory editor component for vocabulary items using TipTap.
 * Allows adding text notes, linking messages, and drag-drop.
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
  // Linked messages data (fetched from API)
  const [linkedMessagesMap, setLinkedMessagesMap] = useState<Map<string, LinkedMessageAttrs>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobile, setMobile] = useState(isMobile);
  const [draggedResult, setDraggedResult] = useState<MessageSearchResult | null>(null);

  // File input ref for images
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create message block extension (memoized)
  const MessageBlockExtension = useMemo(() => createMessageBlockExtension(), []);

  // Detect mobile/desktop on resize
  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch linked messages when existing memory has linked IDs
  useEffect(() => {
    if (existingMemory?.userMemory) {
      const linkedIds = extractLinkedIds(existingMemory.userMemory);
      if (linkedIds.length > 0) {
        void fetchLinkedMessages(linkedIds);
      }
    }
  }, [existingMemory]);

  /**
   * Fetches message details for linked IDs.
   */
  const fetchLinkedMessages = async (ids: string[]) => {
    setIsLoadingLinked(true);
    const messagesMap = new Map<string, LinkedMessageAttrs>();

    for (const id of ids) {
      try {
        const response = await authFetch(apiUrl(`/api/journal/search?q=${encodeURIComponent(id)}&limit=10`));
        if (response.ok) {
          const data = (await response.json()) as { results: MessageSearchResult[] };
          const result = data.results.find((r) => r.messageId === id);
          if (result) {
            messagesMap.set(id, {
              messageId: result.messageId,
              text: result.content,
              characterName: result.characterName,
              date: new Date(result.journalDate).toLocaleDateString("vi-VN"),
              audioData: result.audio
            });
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    setLinkedMessagesMap(messagesMap);
    setIsLoadingLinked(false);
  };

  // Parse initial content for TipTap
  const initialContent = useMemo((): JSONContent => {
    if (existingMemory?.userMemory && linkedMessagesMap.size > 0) {
      return parseMemoryToTipTap(existingMemory.userMemory, linkedMessagesMap);
    }
    if (existingMemory?.userMemory) {
      // Show plain text while loading linked messages
      const plainText = existingMemory.userMemory.replace(/\[MSG:[^\]]+\]/g, "").trim();
      if (plainText) {
        return {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: plainText }] }]
        };
      }
    }
    return { type: "doc", content: [{ type: "paragraph" }] };
  }, [existingMemory, linkedMessagesMap]);

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false
      }),
      Placeholder.configure({
        placeholder: "Viết ký ức của bạn ở đây...",
        emptyEditorClass: "is-editor-empty"
      }),
      MessageBlockExtension,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "memory-image"
        }
      })
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "tiptap-editor"
      }
    }
  }, [initialContent]);

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
   * Gets linked message IDs from current editor content.
   */
  const getLinkedMessageIds = useCallback((): string[] => {
    if (!editor) return [];
    const json = editor.getJSON();
    const ids: string[] = [];

    const traverse = (node: JSONContent) => {
      if (node.type === "messageBlock" && node.attrs?.messageId) {
        const msgId = node.attrs.messageId as string;
        if (!ids.includes(msgId)) {
          ids.push(msgId);
        }
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    traverse(json);
    return ids;
  }, [editor]);

  /**
   * Checks if a message is already linked in editor.
   */
  const isLinked = useCallback((messageId: string): boolean => {
    return getLinkedMessageIds().includes(messageId);
  }, [getLinkedMessageIds]);

  /**
   * Inserts a message block into the editor.
   */
  const insertMessage = useCallback((result: MessageSearchResult) => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "messageBlock",
          attrs: {
            messageId: result.messageId,
            text: result.content,
            characterName: result.characterName,
            date: new Date(result.journalDate).toLocaleDateString("vi-VN"),
            audioData: result.audio
          }
        },
        {
          type: "paragraph"
        }
      ])
      .run();

    if (mobile) {
      setShowMobileSearch(false);
    }
  }, [editor, mobile]);

  /**
   * Handles drag start for search results.
   */
  const handleDragStart = useCallback((e: React.DragEvent, result: MessageSearchResult) => {
    setDraggedResult(result);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", result.content);
  }, []);

  /**
   * Handles drag end.
   */
  const handleDragEnd = useCallback(() => {
    setDraggedResult(null);
  }, []);

  /**
   * Handles image upload.
   */
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  }, [editor]);

  /**
   * Triggers image upload dialog.
   */
  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Saves the memory.
   */
  const handleSave = useCallback(async () => {
    if (!editor) return;

    const json = editor.getJSON();
    const { text, messageIds } = serializeTipTapContent(json);

    const hasContent = text.trim() || messageIds.length > 0;
    if (!hasContent) {
      alert("Vui lòng nhập ký ức của bạn với từ này.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(text, messageIds);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  /**
   * Renders search content panel.
   */
  const renderSearchContent = () => (
    <div className="vocab-memory-editor__search-content">
      {/* Search input */}
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

      {/* Re-search button */}
      {hasSearched && !isSearching && (
        <button
          type="button"
          className="vocab-memory-editor__re-search-btn"
          onClick={() => void handleSearch()}
        >
          🔄 Tìm lại
        </button>
      )}

      {/* Loading */}
      {isSearching && (
        <div className="vocab-memory-editor__search-loading">
          <span className="vocab-memory-editor__spinner" />
          <p>Đang tìm kiếm...</p>
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="vocab-memory-editor__search-error">⚠️ {searchError}</div>
      )}

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="vocab-memory-editor__results">
          <div className="vocab-memory-editor__results-header">
            📝 {searchResults.length} kết quả
            {!mobile && <span className="vocab-memory-editor__drag-hint">Kéo thả để chèn</span>}
          </div>

          <ul className="vocab-memory-editor__results-list">
            {searchResults.map((result, index) => (
              <li
                key={`${result.messageId}-${index}`}
                className={`vocab-memory-editor__result-item ${isLinked(result.messageId) ? "vocab-memory-editor__result-item--linked" : ""} ${draggedResult === result ? "vocab-memory-editor__result-item--dragging" : ""}`}
                draggable={!mobile && !isLinked(result.messageId)}
                onDragStart={(e) => handleDragStart(e, result)}
                onDragEnd={handleDragEnd}
              >
                <div className="vocab-memory-editor__result-meta">
                  <span className="vocab-memory-editor__result-char">👤 {result.characterName}</span>
                  <span className="vocab-memory-editor__result-date">
                    📅 {new Date(result.journalDate).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <p className="vocab-memory-editor__result-content">{result.content}</p>
                {result.translation && (
                  <p className="vocab-memory-editor__result-translation">{result.translation}</p>
                )}
                <button
                  type="button"
                  className="vocab-memory-editor__link-btn"
                  onClick={() => insertMessage(result)}
                  disabled={isLinked(result.messageId)}
                >
                  {isLinked(result.messageId) ? "✓ Đã liên kết" : "+ Chèn vào"}
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
  );

  return (
    <div className={`vocab-memory-editor ${mobile ? "vocab-memory-editor--mobile" : "vocab-memory-editor--desktop"}`}>
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
          {/* Toolbar */}
          <div className="vocab-memory-editor__toolbar">
            <span className="vocab-memory-editor__toolbar-label">💭 Ký ức</span>
            <div className="vocab-memory-editor__toolbar-actions">
              {mobile && (
                <button
                  type="button"
                  className="vocab-memory-editor__mobile-search-btn"
                  onClick={() => setShowMobileSearch(true)}
                >
                  🔍 Tìm tin nhắn ({searchResults.length})
                </button>
              )}
              <button
                type="button"
                className="vocab-memory-editor__format-btn"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                data-active={editor?.isActive("bold")}
                title="Đậm"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className="vocab-memory-editor__format-btn"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                data-active={editor?.isActive("italic")}
                title="Nghiêng"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className="vocab-memory-editor__format-btn vocab-memory-editor__image-btn"
                onClick={triggerImageUpload}
                title="Chèn ảnh"
              >
                🖼️
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* TipTap Editor */}
          <div
            className={`vocab-memory-editor__editor-container ${draggedResult ? "vocab-memory-editor__editor-container--drop-target" : ""}`}
            onDragOver={(e) => {
              if (draggedResult) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              if (draggedResult) {
                e.preventDefault();
                insertMessage(draggedResult);
                setDraggedResult(null);
              }
            }}
          >
            {isLoadingLinked ? (
              <div className="vocab-memory-editor__loading">
                <span className="vocab-memory-editor__spinner" />
                <p>Đang tải tin nhắn liên kết...</p>
              </div>
            ) : (
              <EditorContent editor={editor} />
            )}
            {draggedResult && (
              <div className="vocab-memory-editor__drop-overlay">
                <span>📥 Thả để chèn tin nhắn</span>
              </div>
            )}
          </div>

          {/* Tips */}
          <p className="vocab-memory-editor__tip">
            {mobile
              ? "💡 Nhấn \"Tìm tin nhắn\" để thêm ngữ cảnh, 🖼️ để chèn ảnh"
              : "💡 Kéo tin nhắn từ bên phải hoặc nhấn 🖼️ để chèn ảnh"}
          </p>
        </div>

        {/* Search panel - Desktop only */}
        {!mobile && (
          <div className="vocab-memory-editor__search-section">
            <h4 className="vocab-memory-editor__search-title">🔍 Tin nhắn liên quan</h4>
            <span className="vocab-memory-editor__vocab-target">{vocabulary.korean}</span>
            {renderSearchContent()}
          </div>
        )}
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
          disabled={isSaving}
        >
          {isSaving ? "⏳ Đang lưu..." : "💾 Lưu ký ức"}
        </button>
      </footer>

      {/* Mobile Search Modal */}
      {mobile && showMobileSearch && (
        <div className="vocab-memory-editor__mobile-modal">
          <div
            className="vocab-memory-editor__modal-overlay"
            onClick={() => setShowMobileSearch(false)}
          />
          <div className="vocab-memory-editor__modal-content">
            <div className="vocab-memory-editor__modal-header">
              <h4>🔍 Tìm: {vocabulary.korean}</h4>
              <button
                type="button"
                className="vocab-memory-editor__modal-close"
                onClick={() => setShowMobileSearch(false)}
              >
                ✕
              </button>
            </div>
            {renderSearchContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default VocabularyMemoryEditor;
