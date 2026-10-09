/**
 * useChat - 对话管理 hook
 *
 * 封装聊天全流程：发送消息-》SSE流式请求 -〉逐 chunk 更新消息 ——》结束
 * 包含 AbortController 管理和 Pending Message Quene
 *
 * ChatBridge 解决的问题
 * openPanel(question) 可能在 Chat 画板挂载前触发
 * -》
 */

import { useCallback, useEffect, useRef } from "react";
import {
  StreamEventType,
  type AgentId,
  type CopilotMessage,
} from "../core/types";
import { useChatStore } from "../store/chat-store";
import { resetSessionId, streamChat } from "../core/chat-provider";
import { createFrameBatcher } from "../core/frame-batcher";
import { getWriteMode } from "../core/write-mode";

type SendMessageHandler = (query: string, agentId?: AgentId) => void;

class ChatBridge {
  private handler?: SendMessageHandler;
  private pendingMessages: Array<{ query: string; agentId?: AgentId }> = [];

  registerHandler(handler: SendMessageHandler) {
    this.handler = handler;
    // drain: 画板挂载后，把缓冲的消息全部重放
    this.pendingMessages.forEach(({ query, agentId }) =>
      handler(query, agentId),
    );
    this.pendingMessages = [];
  }

  /** 更新 handler 引用（解决 stale closure) */
  updateHandler(handler: SendMessageHandler) {
    this.handler = handler;
  }

  unregisterHandler() {
    this.handler = undefined;
  }

  sendMessage(query: string, agentId?: AgentId) {
    if (this.handler) {
      this.handler(query, agentId);
    } else {
      this.pendingMessages.push({ query, agentId });
    }
  }
}

/** 全局单例 */
export const chatBridge = new ChatBridge();

export const useChat = () => {
  const {
    messages,
    isRequesting,
    currentAgentId,
    addUserMessage,
    updateLastAssistantMessage,
    setLastAssistantMessage,
    setRequesting,
    setCurrentAgentId,
    abortRequest,
    clearMessages,
    createAbortController,
  } = useChatStore();

  const bridgeRegistered = useRef(false);

  /** 发送消息 */
  const sendMessage = useCallback(
    async (query: string, agentId?: AgentId) => {
      const finalAgentId = agentId || currentAgentId;

      addUserMessage(query);

      const placeholderMessage: CopilotMessage = {
        text: "",
        rawText: "",
        think: "",
        events: [
          { id: `start_${Date.now()}`, type: StreamEventType.AssistantStart },
        ],
        finished: false,
        agentId: finalAgentId,
      };

      setLastAssistantMessage(placeholderMessage);
      setRequesting(true);

      const controller = createAbortController();
      // 合帧模式下的写入器：每个请求独立一个，避免串会话
      const batcher = createFrameBatcher<CopilotMessage>((m) =>
        updateLastAssistantMessage(m),
      );
      // 当前生效的写入模式；流式途中允许切换对比，但切换瞬间要先处理缓存
      let activeMode = getWriteMode();
      try {
        await streamChat(
          { query, userId: "demo_user", agentId: finalAgentId },
          (updateMessage) => {
            const mode = getWriteMode();
            if (mode !== activeMode) {
              // 合帧 -> 逐 token：先把缓存的最新快照写出，再按新模式直写。
              // 否则缓存里的旧快照会在更新的内容之后落库，文本回退
              if (activeMode === "frame") batcher.flushNow();
              activeMode = mode;
            }
            if (mode === "frame") {
              batcher.push(updateMessage);
            } else {
              updateLastAssistantMessage(updateMessage);
            }
          },
          controller.signal,
        );
        // 流正常结束：立即写出最后一帧缓存，保证 finished 状态落库
        batcher.flushNow();
      } catch (error: unknown) {
        // 出错：丢弃缓存快照，避免旧内容覆盖错误提示
        batcher.drop();
        const err = error as Error;
        if (err.name === "AbortError") {
          setLastAssistantMessage({
            ...placeholderMessage,
            finished: true,
            interrupted: true,
            error: "已停止生成",
          });
        } else {
          setLastAssistantMessage({
            ...placeholderMessage,
            finished: true,
            error: err.message || "请求失败，请重试",
          });
        }
      } finally {
        setRequesting(false);
      }
    },
    [
      currentAgentId,
      addUserMessage,
      updateLastAssistantMessage,
      setLastAssistantMessage,
      setRequesting,
      createAbortController,
    ],
  );

  // 每当 sendMessage 变化时， 更新 bridge 中的 handler
  useEffect(() => {
    if (bridgeRegistered.current) {
      chatBridge.updateHandler(sendMessage);
    }
  }, [sendMessage]);

  const registerBridge = useCallback(() => {
    if (!bridgeRegistered.current) {
      chatBridge.registerHandler(sendMessage);
      bridgeRegistered.current = true;
    }
    // 只在挂载时注册一次， handler 通过 updateHanlder 更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unRegisterBridge = useCallback(() => {
    chatBridge.unregisterHandler();
    bridgeRegistered.current = false;
  }, []);

  const startNewConversation = useCallback(() => {
    clearMessages();
    resetSessionId();
  }, [clearMessages]);

  return {
    messages,
    isRequesting,
    currentAgentId,
    sendMessage,
    abortRequest,
    setCurrentAgentId,
    registerBridge,
    unRegisterBridge,
    startNewConversation,
  };
};
