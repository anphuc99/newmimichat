import { FormEvent, KeyboardEvent } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  disabled?: boolean;
}

/**
 * Renders the message composer for chat.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message input component.
 */
const MessageInput = ({ value, onChange, onSend, disabled }: MessageInputProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    // Enter submits, Shift+Enter inserts a newline.
    event.preventDefault();
    onSend(value);
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        className="chat-input__field"
        rows={3}
        placeholder="Type your message..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button className="chat-input__button" type="submit" disabled={disabled}>
        {disabled ? "Sending..." : "Send"}
      </button>
    </form>
  );
};

export default MessageInput;
