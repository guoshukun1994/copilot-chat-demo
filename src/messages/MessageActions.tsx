import React, { useState } from "react";
import { CopyOutlined, DislikeOutlined, LikeOutlined } from "@ant-design/icons";
import copy from "copy-to-clipboard";
import styles from "./messages.module.css";

const DISLIKE_REASONS = [
  "答非所问",
  "信息不准确",
  "内容不完整",
  "步骤不可执行",
  "响应太慢",
  "其他",
];

interface MessageActionsProps {
  content: string;
  reqId: string;
  sessionId?: string;
}

const MessageActions: React.FC<MessageActionsProps> = ({ content, reqId }) => {
  const [feedback, setFeedback] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [showDislikeMenu, setShowDislikeMenu] = useState(false);
  const [dislikeReason, setDislikeReason] = useState<string | null>(null);

  const handleCopy = () => {
    copy(content);
  };
  const handleLike = () => {
    setFeedback("LIKE");
    console.log("[Copilot] Liked", { reqId });
  };
  const handleDislike = () => {
    if (feedback === "DISLIKE") return;
    setShowDislikeMenu(!showDislikeMenu);
  };
  const handleDislikeReason = (reason: string) => {
    setFeedback("DISLIKE");
    setDislikeReason(reason);
    setShowDislikeMenu(false);
    console.log("[Copilot] Disliked", { reqId, reason });
  };

  return (
    <div className={styles.messageActions}>
      <button
        className={styles.actionBtn}
        onClick={handleCopy}
        title="复制"
        aria-label="复制回答内容"
      >
        <CopyOutlined />
      </button>
      {feedback !== "DISLIKE" && (
        <button
          className={styles.actionBtn}
          onClick={handleLike}
          title="赞"
          aria-label="点赞"
          aria-pressed={feedback === "LIKE"}
        >
          <LikeOutlined
            style={feedback === "LIKE" ? { color: "#1677ff" } : {}}
          />
        </button>
      )}
      <span className={styles.dislikeWrapper}>
        {showDislikeMenu && feedback !== "DISLIKE" && (
          <div className={styles.dislikeMenu} role="menu">
            {DISLIKE_REASONS.map((reason) => (
              <button
                key={reason}
                className={styles.dislikeReasonBtn}
                onClick={() => handleDislikeReason(reason)}
                role="menuitem"
              >
                {reason}
              </button>
            ))}
          </div>
        )}
        <button
          className={styles.actionBtn}
          onClick={handleDislike}
          title="踩"
          aria-label="点踩"
          aria-pressed={feedback === "DISLIKE"}
        >
          <DislikeOutlined
            style={feedback === "DISLIKE" ? { color: "#1677ff" } : {}}
          />
        </button>
      </span>
      {dislikeReason && (
        <span className={styles.dislikeTag}>原因：{dislikeReason}</span>
      )}
    </div>
  );
};

export default MessageActions;
