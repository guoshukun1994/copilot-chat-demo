import React, { useState, useEffect, useRef } from "react";
import styles from "./messages.module.css";

interface DeepThinkBlockProps {
  think: string;
  isThinking?: boolean;
}

const DeepThinkBlock: React.FC<DeepThinkBlockProps> = ({
  think,
  isThinking,
}) => {
  const [expanded, setExpanded] = useState(() => isThinking ?? false);
  const prevIsThinkingRef = useRef(isThinking);

  // isThinking 从 true → false 时自动折叠
  useEffect(() => {
    if (prevIsThinkingRef.current === true && isThinking === false) {
      setExpanded(false);
    }
    prevIsThinkingRef.current = isThinking;
  }, [isThinking]);

  if (!think) return null;

  return (
    <div className={styles.deepThink}>
      <div
        className={styles.deepThinkHeader}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={isThinking ? "思考中，点击展开" : "已完成思考，点击展开"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span
          className={`${styles.deepThinkIcon} ${isThinking ? styles.spinning : ""}`}
        >
          💡
        </span>
        <span className={styles.deepThinkTitle}>
          {isThinking ? "思考中..." : "已完成思考"}
        </span>
        <span className={styles.deepThinkToggle}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && <div className={styles.deepThinkContent}>{think}</div>}
    </div>
  );
};

export default DeepThinkBlock;
