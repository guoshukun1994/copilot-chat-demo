import React from "react";
import type { CopilotMessage } from "../core/types";
import DeepThinkBlock from "./DeepThinkBlock";
import ToolCallCard from "./ToolCallCard";
import MessageActions from "./MessageActions";
import MarkdownContent from "./MarkdownContent";
import styles from "./messages.module.css";

interface MessageBubbleProps {
  message: CopilotMessage;
  isRequesting?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isRequesting,
}) => {
  window.__streamProbe?.bubble();
  // 用户消息
  if (message.query) {
    return (
      <div className={styles.userBubble}>
        <div className={styles.userContent}>{message.query}</div>
      </div>
    );
  }

  // AI 消息 — segments 格式
  const segments = message.segments || [];
  if (segments.length > 0) {
    return (
      <div className={styles.aiBubble}>
        {segments.map((segment, idx) => (
          <div key={segment.id || idx} className={styles.aiSegment}>
            {segment.think && (
              <DeepThinkBlock
                think={segment.think}
                isThinking={!segment.finished && isRequesting}
              />
            )}
            {segment.events
              .filter((e) => e.type === "assistant_tool_use")
              .map((event) => (
                <ToolCallCard key={event.id} event={event} />
              ))}
            {segment.text && (
              <MarkdownContent
                text={segment.text}
                streaming={!segment.finished && isRequesting}
              />
            )}
            {segment.error && (
              <div className={styles.aiError}>{segment.error}</div>
            )}
            {segment.interrupted && (
              <div className={styles.aiInterrupted}>
                接口中断，请输入继续执行
              </div>
            )}
            {segment.finished &&
              segment.text &&
              message.reqId &&
              idx === segments.length - 1 && (
                <MessageActions
                  content={segment.text}
                  reqId={message.reqId || ""}
                  sessionId={message.sessionId}
                />
              )}
          </div>
        ))}
      </div>
    );
  }

  // 兼容旧格式
  const thinkText = message.think || "";
  const answerText = message.text || "";
  const toolEvents = (message.events || []).filter(
    (e) => e.type === "assistant_tool_use",
  );

  return (
    <div className={styles.aiBubble}>
      {thinkText && (
        <DeepThinkBlock
          think={thinkText}
          isThinking={!message.finished && isRequesting}
        />
      )}
      {toolEvents.map((event) => (
        <ToolCallCard key={event.id} event={event} />
      ))}
      {answerText && (
        <MarkdownContent
          text={answerText}
          streaming={!message.finished && isRequesting}
        />
      )}
      {message.error && <div className={styles.aiError}>{message.error}</div>}
      {message.interrupted && (
        <div className={styles.aiInterrupted}>接口中断，请输入继续执行</div>
      )}
      {message.finished && answerText && message.reqId && (
        <MessageActions
          content={answerText}
          reqId={message.reqId}
          sessionId={message.sessionId}
        />
      )}
    </div>
  );
};

export default MessageBubble;
