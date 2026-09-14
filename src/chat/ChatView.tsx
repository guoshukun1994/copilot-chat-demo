import React from "react";
import { useChat } from "../hooks/useChat";
import { useAutoScroll } from "../hooks/useAutoScroll";
import MessageBubble from "../messages/MessageBubble";
import ChatInput from "./ChatInput";
import Welcome from "./Welcome";
import AgentSwitcher from "./AgentSwitcher";
import { AGENT_CONFIGS } from "../agent/agent-router";
import { AgentId } from "../core/types";
import styles from "./chat.module.css";

const ChatView: React.FC = () => {
  const {
    messages,
    isRequesting,
    currentAgentId,
    sendMessage,
    abortRequest,
    setCurrentAgentId,
    registerBridge,
    unRegisterBridge,
  } = useChat();

  const containerRef = useAutoScroll(messages);

  React.useEffect(() => {
    registerBridge();
    return () => unRegisterBridge();
  }, [registerBridge, unRegisterBridge]);

  const hasMessages = messages.length > 0;
  const currentConfig = AGENT_CONFIGS.find((c) => c.id === currentAgentId);

  return (
    <div className={styles.chatView}>
      <AgentSwitcher
        currentAgentId={currentAgentId}
        onAgentChange={setCurrentAgentId}
      />

      <div ref={containerRef} className={styles.messageList}>
        {!hasMessages && <Welcome onQuestionClick={(q) => sendMessage(q)} />}
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg._msgId ?? idx}
            message={msg}
            isRequesting={
              isRequesting && idx === messages.length - 1 && !msg.query
            }
          />
        ))}
        {isRequesting &&
          messages.length > 0 &&
          !messages[messages.length - 1]?.text &&
          !messages[messages.length - 1]?.query && (
            <div className={styles.thinkingHint}>
              <span className={styles.thinkingDot} />
              {currentConfig?.id === AgentId.DeepThink
                ? "深度思考中..."
                : "正在思考..."}
            </div>
          )}
      </div>

      <ChatInput
        onSend={(value) => sendMessage(value)}
        onStop={abortRequest}
        isRequesting={isRequesting}
        placeholder={`向${currentConfig?.name || "Copilot"}提问...`}
      />
    </div>
  );
};

export default ChatView;
