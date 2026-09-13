/**
 * ChatProvider - 串联所有 core 模块
 *
 * 职责：
 *  1. 发起 SSE 请求（fetch + 空闲超时守卫）
 *  2. 解析 SSE 帧（parseAgenthubSSEFrames)
 *  3. 转换消息（transformAgenthubMessage)
 *  4. 管理会话 ID
 */

import { parseAgenthubSSEFrames } from "./parse-sse-frames";
import { withStreamIdleTimeout } from "./stream-idle-timeout";
import { transformAgenthubMessage } from "./transform-message";
import {
  StreamEventType,
  type CopilotInput,
  type CopilotMessage,
  type SSEOutput,
} from "./types";

const CHAT_API_URL = "/api/chat";

const generateSessionId = () => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

let currentSessionId = "";

export const ensureSessionId = (sessionId?: string): string => {
  if (sessionId) return sessionId;
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
  }
  return currentSessionId;
};

export const resetSessionId = () => {
  currentSessionId = "";
};

/**
 * 发起流式聊天请求
 *
 * @param input 用户输入
 * @param onUpdate 每次chunk 到达时的回调
 * @param signal AbortSignal
 */
export const streamChat = async (
  input: CopilotInput,
  onUpdate?: (message: CopilotMessage) => void,
  signal?: AbortSignal,
): Promise<CopilotMessage> => {
  const sessionId = ensureSessionId();
  const streamStartedAt = Date.now();

  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      agentId: input.agentId || "normal",
      userId: input.userId || "demo_user",
      sessionId,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const guardedResponse = withStreamIdleTimeout(response);
  if (!guardedResponse.body) {
    throw new Error("Empty response body");
  }

  let message: CopilotMessage = {
    text: "",
    rawText: "",
    events: [
      { id: `start_${Date.now()}`, type: StreamEventType.AssistantStart },
    ],
    finished: false,
    streamStartedAt,
  };

  const reader = guardedResponse.body.getReader();
  const decoder = new TextDecoder();
  const sseBuffer = { current: "" };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const frames = parseAgenthubSSEFrames(text, sseBuffer);

      for (const frame of frames) {
        const chunk: SSEOutput = { data: frame };
        message = transformAgenthubMessage(message, chunk);
        onUpdate?.(message);
      }
    }

    // 处理 buffer 中可能残留的最后一段
    if (sseBuffer.current.trim()) {
      const finalFrames = parseAgenthubSSEFrames("\n\n", sseBuffer);
      for (const frame of finalFrames) {
        const chunk: SSEOutput = { data: frame };
        message = transformAgenthubMessage(message, chunk);
        onUpdate?.(message);
      }
    }
  } catch (_error) {
    console.log("_error", _error);
    // 这里可以记录错误日志
    // 不要再写重复的结束逻辑
  } finally {
    if (!message.finished) {
      message = transformAgenthubMessage(message, undefined);
      onUpdate?.(message);
    }
  }

  return message;
};
