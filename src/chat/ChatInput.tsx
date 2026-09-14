import React, { useState, useCallback, useRef, useEffect } from "react";
import { SendOutlined, StopOutlined } from "@ant-design/icons";
import styles from "./chat.module.css";

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 21;

interface ChatInputProps {
  onSend: (value: string) => void;
  onStop: () => void;
  isRequesting: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isRequesting,
  placeholder = "输入问题...",
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = `${MIN_ROWS * LINE_HEIGHT}px`;
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = MAX_ROWS * LINE_HEIGHT;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) textarea.style.height = `${MIN_ROWS * LINE_HEIGHT}px`;
    });
  }, [value, onSend]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [],
  );

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          const textarea = e.currentTarget;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = value.slice(0, start) + "\n" + value.slice(end);
          setValue(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          });
        } else if (!e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      }
    },
    [value, handleSend],
  );

  return (
    <div className={styles.chatInput}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          aria-label="消息输入框"
        />
        {isRequesting ? (
          <button
            className={styles.stopBtn}
            onClick={onStop}
            title="停止生成"
            aria-label="停止生成"
          >
            <StopOutlined />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!value.trim()}
            title="发送"
            aria-label="发送消息"
          >
            <SendOutlined />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
