import React, { useState } from "react";
import type { StreamEvent } from "../core/types";
import styles from "./messages.module.css";

interface ToolCallCardProps {
  event: StreamEvent;
}

const ToolCallCard: React.FC<ToolCallCardProps> = ({ event }) => {
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const data = event.data || {};
  const isRunning = data.running === true;
  const isSuccess = data.success === true;
  const isFailed = data.running === false && data.success === false;

  const statusText = isRunning
    ? `正在调用 ${event.content}`
    : isSuccess
      ? `${event.content} 调用完成`
      : isFailed
        ? `${event.content} 调用失败`
        : event.content || "工具调用";

  return (
    <div
      className={`${styles.toolCard} ${isRunning ? styles.toolCardRunning : ""} ${isFailed ? styles.toolCardFailed : ""}`}
    >
      <div className={styles.toolCardHeader}>
        <span
          className={`${styles.toolStatusDot} ${isRunning ? styles.dotRunning : isSuccess ? styles.dotSuccess : styles.dotFailed}`}
        />
        <span className={styles.toolStatusText}>{statusText}</span>
      </div>

      {data.input !== undefined && (
        <div className={styles.toolDetail}>
          <div
            className={styles.toolDetailToggle}
            onClick={() => setShowInput(!showInput)}
          >
            📥 输入 {showInput ? "▲" : "▼"}
          </div>
          {showInput && (
            <pre className={styles.toolPre}>
              {typeof data.input === "string"
                ? data.input
                : JSON.stringify(data.input, null, 2)}
            </pre>
          )}
        </div>
      )}

      {data.output !== undefined && (
        <div className={styles.toolDetail}>
          <div
            className={styles.toolDetailToggle}
            onClick={() => setShowOutput(!showOutput)}
          >
            📤 输出 {showOutput ? "▲" : "▼"}
          </div>
          {showOutput && (
            <pre className={styles.toolPre}>
              {typeof data.output === "string"
                ? data.output
                : JSON.stringify(data.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
