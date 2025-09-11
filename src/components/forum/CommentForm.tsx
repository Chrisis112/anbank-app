import * as React from "react";
import { FaPaperPlane } from "react-icons/fa";

interface CommentFormProps {
  onSubmit: (text: string) => void;
}

export default function CommentForm({ onSubmit }: CommentFormProps) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      // Shift+Enter — добавить перенос строки в позицию курсора
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.currentTarget;
      const value = text;
      setText(
        value.substring(0, selectionStart) + "\n" + value.substring(selectionEnd)
      );
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
            selectionStart + 1;
          textareaRef.current.focus();
        }
      }, 0);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mt-4">
      <textarea
        ref={textareaRef}
        className="flex-1 p-3 rounded-lg bg-crypto-input border border-crypto-accent text-white resize-none focus:outline-none focus:ring-2 focus:ring-crypto-accent"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment..."
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="bg-crypto-accent hover:bg-crypto-accent-dark px-5 py-3 rounded-lg text-white flex items-center justify-center"
        aria-label="Submit a comment"
      >
        <FaPaperPlane />
      </button>
    </form>
  );
}
