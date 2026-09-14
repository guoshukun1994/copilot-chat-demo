import React from "react";
import styles from "./chat.module.css";

const QUICK_QUESTIONS = [
  { label: "💡 你能帮我做什么？", value: "你能帮我做什么" },
  { label: "🔍 诊断部署失败", value: "我的部署失败了，帮我诊断一下" },
  { label: "🧠 深度分析", value: "请深度分析模型训练OOM的可能原因" },
  { label: "🏥 调用失败排查", value: "API调用返回500，帮我排查" },
];

interface WelcomeProps {
  onQuestionClick: (question: string) => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onQuestionClick }) => (
  <div className={styles.welcome}>
    <div className={styles.welcomeIcon}>✨</div>
    <h3 className={styles.welcomeTitle}>AIStudio Copilot</h3>
    <p className={styles.welcomeDesc}>
      我是你的AI智能助手，可以帮你诊断部署问题、排查调用失败、解答平台疑问
    </p>
    <div className={styles.quickQuestions}>
      {QUICK_QUESTIONS.map((q) => (
        <button
          key={q.value}
          className={styles.quickQuestionBtn}
          onClick={() => onQuestionClick(q.value)}
        >
          {q.label}
        </button>
      ))}
    </div>
  </div>
);

export default Welcome;
