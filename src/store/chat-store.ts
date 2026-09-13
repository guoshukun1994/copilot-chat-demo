/**
 * 对话状态管理 - 消息列表、会话、请求控制
 */

import { create } from "zustand";
import { AgentId } from "../core/types";
import { type CopilotMessage } from "../core/types";

interface ChatState {
  messages: CopilotMessage[];
  isRequesting: boolean;
  currentAgentId: AgentId;
  abortController: AbortController | null;
  _nextMsgId: number;
}

interface ChatActions {
  addUserMessage: (query: string) => void;
  updateLastAssistantMessage: (message: CopilotMessage) => void;
  setLastAssistantMessage: (message: CopilotMessage) => void;
  setRequesting: (isRequesting: boolean) => void;
  setCurrentAgentId: (id: AgentId) => void;
  abortRequest: () => void;
  clearMessages: () => void;
  createAbortController: () => AbortController;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isRequesting: false,
  currentAgentId: AgentId.Normal,
  abortController: null,
  _nextMsgId: 1,

  addUserMessage: (query) =>
    set((state) => {
      const msgId = state._nextMsgId;
      return {
        _nextMsgId: msgId + 1,
        messages: [...state.messages, { _msgId: msgId, query, finised: true }],
      };
    }),

  updateLastAssistantMessage: (message) =>
    set((state) => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (msg && !msg.query) {
          msgs[i] = { ...message, _msgId: msg._msgId };
          return { messages: msgs };
        }
      }
      const msgId = state._nextMsgId;
      return {
        _nextMsgId: msgId + 1,
        messages: [...msgs, { ...message, _msgId: msgId }],
      };
    }),

  setLastAssistantMessage: (message) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.findIndex(
        (m, i) => i === msgs.length - 1 && !m.query,
      );
      if (lastIdx >= 0) {
        const existing = msgs[lastIdx];
        msgs[lastIdx] = { ...message, _msgId: existing?._msgId };
      } else {
        const msgId = state._nextMsgId;
        msgs.push({ ...message, _msgId: msgId });
        return { _nextMsgId: msgId + 1, message: msgs };
      }
      return { messages: msgs };
    }),

  setRequesting: (isRequesting) => set({ isRequesting }),

  setCurrentAgentId: (id) => set({ currentAgentId: id }),

  abortRequest: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
      set({ abortController: null, isRequesting: false });
    }
  },

  clearMessages: () => set({ messages: [], _nextMsgId: 1 }),

  createAbortController: () => {
    const controller = new AbortController();
    set({ abortController: controller });
    return controller;
  },
}));

// 细粒度选择器
export const useMessage = () => useChatStore((s) => s.message);
export const useIsRequesting = () => useChatStore((s) => s.isRequesting);
export const useCurrentAgentId = () => useChatStore((s) => s.currentAgentId);

/**
 * 为什么用 _nextMsgId?
 * React 的 key 数组索引 idx 会导致流式更新时不必要的 re-render.自增 ID 保证每条消息有稳定身份。
 */
