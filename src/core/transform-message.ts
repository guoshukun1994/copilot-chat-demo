/**
 * transformAgenthubMessage - 核心状态机
 *
 * 职责：每次 SSE chunk 到达时，消息 += chunk -> 新消息
 *
 * 核心数据流：
 *    SSE chunk -> parseStreamData -> payload
 *      - payload.data 存在 -> StreamChatEnvelope(新协议)
 *        - contentType === 'thinking' -> segment.think += output
 *        - contentType === 'thought' + TOOL -> 工具事件
 *        - contentType ∈ HIDDEN -> 跳过
 *        - 其他 -> extractInlineToolEvents -> 可见文本 + 工具事件
 *      - isStreamChatFinished -> 标记 finished, 处理业务错误
 *
 * Segments 多段渲染
 *      DeepThink 模式下， 一次AI响应可能包含多段「推理 + 回答」
 */

import { isVisibleContentType } from "./constants";
import {
  extractInlineToolEvents,
  parseMaybeJson,
  toToolStreamEvent,
} from "./extract-inline-tool-events";
import { stripThinkContent } from "./strip-think";
import {
  StreamEventType,
  type AgentHubEvent,
  type AgenthubInlineToolEvent,
  type CopilotMessage,
  type CopilotMessageSegment,
  type StreamEvent,
} from "./types";

const EMPTY_RESPONSE_FALLBACK = "请求失败，请重试";

// ---- Segment 辅助函数 ----
const createAssistantSegment = (
  id: string,
  withStartEvent = true,
): CopilotMessageSegment => ({
  id,
  text: "",
  rawText: "",
  think: "",
  events: withStartEvent
    ? [{ id: `start_${id}`, type: StreamEventType.AssistantStart }]
    : [],
  finished: false,
});

const ensureAssistantStartEvent = (
  events: StreamEvent[],
  id: string,
): StreamEvent[] => {
  if (events.some((e) => e.type === StreamEventType.AssistantStart))
    return events;
  return [
    ...events,
    { id: `start_${id}`, type: StreamEventType.AssistantStart },
  ];
};

const appendSegmentText = (segment: CopilotMessageSegment, text: string) => {
  segment.rawText = `${segment.rawText || ""}${text}`;
  segment.text = stripThinkContent(segment.rawText);
};

const appendToolToSegmentEvents = (
  segment: CopilotMessageSegment,
  event: StreamEvent,
) => {
  segment.events = [
    ...ensureAssistantStartEvent(segment.events || [], segment.id),
    event,
  ];
};

const hasSegmentAnswer = (segment?: CopilotMessageSegment) =>
  Boolean(stripThinkContent(segment?.rawText || "").trim());

const isReasoningOnlySegment = (segment?: CopilotMessageSegment) =>
  Boolean(
    segment &&
    !hasSegmentAnswer &&
    (segment.think?.trim() ||
      segment.events.some((e) => e.type === StreamEventType.AsistantToolUse)),
  );

const hasSegmentContent = (segment?: CopilotMessageSegment) =>
  Boolean(
    segment &&
    (segment.rawText.trim() ||
      segment.think?.trim() ||
      segment.error?.trim() ||
      segment.events.some((e) => e.type === StreamEventType.AsistantToolUse) ||
      segment.interrupted),
  );

const markStreamInterruped = (
  segment: CopilotMessageSegment,
  reason: string,
) => {
  segment.finished = true;
  segment.interrupted = true;
  console.warn("[Copilot] stream interrupted", {
    reason,
    segmentId: segment.id,
  });
};

const lastSegment = (
  segments: CopilotMessageSegment[],
): CopilotMessageSegment | undefined => segments[segments.length - 1];

const ensureWritableSegment = (
  segments: CopilotMessageSegment[],
  reqId: string,
  options: { startNew?: boolean } = {},
): CopilotMessageSegment => {
  const last = lastSegment(segments);
  if (options.startNew && last) {
    last.finished = true;
  }

  if (options.startNew || segments.length === 0) {
    const segmentId =
      segments.length === 0 ? reqId : `${reqId}_${segments.length + 1}`;
    const segment = createAssistantSegment(segmentId);
    segments.push(segment);
    return segment;
  }

  const segment = lastSegment(segments)!;
  segment.events = ensureAssistantStartEvent(segment.events || [], segment.id);
  return segment;
};

const shouldStartNewReasoningSegment = (segments: CopilotMessageSegment[]) =>
  hasSegmentAnswer(lastSegment(segments));

const finalizeSegments = (
  originMessage: CopilotMessage | undefined,
  segments: CopilotMessageSegment[],
  finished: boolean,
): CopilotMessage => {
  const normalizedSegments = segments.filter(hasSegmentContent);
  const text = normalizedSegments.map((s) => s.text || "").join("");
  const rawText = normalizedSegments.map((s) => s.rawText || "").join("");
  const think = normalizedSegments.map((s) => s.think || "").join("");
  const events = normalizedSegments.flatMap((s) => s.events || []);
  const interrupted = Boolean(
    originMessage?.interrupted || normalizedSegments.some((s) => s.interrupted),
  );
  const errors = normalizedSegments.map((s) => s.error || "").filter(Boolean);
  const error = errors[errors.length - 1];

  return {
    ...originMessage,
    text,
    rawText,
    think,
    error,
    events,
    segments: normalizedSegments,
    finished,
    ...(interrupted ? { interrupted } : {}),
  };
};

const normalizeMessageSegments = (
  message: CopilotMessage | undefined,
  fallbackId: string,
): CopilotMessageSegment[] => {
  if (message?.segments?.length) {
    return message.segments.map((s) => ({
      id: s.id || fallbackId,
      text: s.text || stripThinkContent(s.rawText || ""),
      rawText: s.rawText || "",
      think: s.think || "",
      error: s.error || "",
      events: [...(s.events || [])],
      finished: s.finished,
      interrupted: s.interrupted,
    }));
  }

  const rawText = message?.rawText || "";
  const text = message?.text || stripThinkContent(rawText);
  const think = message?.think || "";
  if (!rawText && !text && !think) return [];

  return [
    {
      id: fallbackId,
      text,
      rawText,
      think,
      error: "",
      events: [...(message?.events || [])],
      finished: message?.finished,
      interrupted: message?.interrupted,
    },
  ];
};

// ----- 解析辅助 -----
const parseStreamData = (data?: string) => {
  if (!data || data === "[DONE]") return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
};

const parseInlineToolEvent = (content?: {
  text?: string;
  type?: string;
  event?: AgenthubInlineToolEvent;
}) => {
  if (!content) return undefined;
  const parsed = parseMaybeJson(content.text);
  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as Record<string, unknown>).type === "TOOL"
  ) {
    return parsed as AgenthubInlineToolEvent;
  }
  if (content.type === "TOOL" && content.event) return content.event;
  return undefined;
};

// ---- 主函数 ----
export const transformAgenthubMessage = (
  originMessage: CopilotMessage | undefined,
  chunk: { data?: string } | undefined,
): CopilotMessage => {
  const payload = parseStreamData(chunk?.data);
  const fallbackId = `segment_${Date.now()}_0`;
  const segments = normalizeMessageSegments(originMessage, fallbackId);

  // ---- 流结束但 payload 为空（异常场景）----
  if (!payload) {
    if (originMessage?.finished) {
      return finalizeSegments(originMessage, segments, true);
    }
    const segment = ensureWritableSegment(segments, fallbackId);
    if (isReasoningOnlySegment(segment)) {
      markStreamInterruped(segment, "stream_end_without_finish");
      return finalizeSegments(originMessage, segments, true);
    }
    const hasVisibleText = segments.some((s) =>
      stripThinkContent(s.rawText).trim(),
    );
    if (hasVisibleText) {
      markStreamInterruped(segment, "stream_end_without_finish");
      return finalizeSegments(originMessage, segments, true);
    }
    if (!stripThinkContent(segment.rawText).trim()) {
      appendSegmentText(segment, EMPTY_RESPONSE_FALLBACK);
    }
    segment.finished = true;
    return finalizeSegments(originMessage, segments, true);
  }

  // ---- StreamChatEnvelope 格式（新协议）
  if (payload.data) {
    const data = payload.data;
    let hasResponseStarted = Boolean(originMessage?.hasResponseStarted);
    const reqId = String(
      data.reqId || data.chatId || data.msgId || segments.length,
    );
    const isFinished = data.finished === true || data.msgType === "CHAT_EXIT";

    data.contents?.forEach(
      (content: {
        contentType?: string;
        content?: {
          text?: string;
          type?: string;
          event?: AgenthubInlineToolEvent;
        };
      }) => {
        const output = content?.content?.text || "";

        if (content.contentType === "thinking") {
          hasResponseStarted = true;
          const segment = ensureWritableSegment(segments, reqId, {
            startNew: shouldStartNewReasoningSegment(segments),
          });
          if (output) segment.think += output;
          return;
        }

        if (
          content.contentType === "thought" &&
          content.content?.type === "TOOL"
        ) {
          const toolEvent = parseInlineToolEvent(content.content);
          if (toolEvent) {
            hasResponseStarted = true;
            const segment = ensureWritableSegment(segments, reqId);
            appendToolToSegmentEvents(segment, toToolStreamEvent(toolEvent));
          }
          return;
        }

        if (!isVisibleContentType(content.contentType)) return;

        const { visibleText, toolEvents } = extractInlineToolEvents(output);
        const segment = ensureWritableSegment(segments, reqId);
        if (visibleText || toolEvents.length > 0) {
          hasResponseStarted = true;
          segment.events = ensureAssistantStartEvent(
            segment.events || [],
            segment.id,
          );
        }
        appendSegmentText(segment, visibleText);
        toolEvents.forEach((toolEvent) => {
          appendToolToSegmentEvents(segment, toolEvent);
        });
      },
    );

    if (isFinished) {
      const hasVisibleText = segments.some((s) =>
        stripThinkContent(s.rawText).trim(),
      );
      const segment = ensureWritableSegment(segments, reqId);
      if (!hasVisibleText && isReasoningOnlySegment(segment)) {
        markStreamInterruped(
          segment,
          data.msgType === "CHAT_EXIT"
            ? "chat_exit_closed"
            : "finish_without_answer",
        );
        return finalizeSegments(originMessage, segments, true);
      }
      if (!stripThinkContent(segment.rawText).trim()) {
        appendSegmentText(segment, EMPTY_RESPONSE_FALLBACK);
      }
      segment.finished = true;
    }

    const finalMessage = finalizeSegments(originMessage, segments, isFinished);
    return {
      ...finalMessage,
      hasResponseStarted,
      agentId: data.agentId || finalMessage.agentId,
      sessionId: data.sessionId || finalMessage.sessionId,
      reqId: data.reqId || finalMessage.reqId,
    };
  }

  // ---- AgenthubEvent 格式（旧协议）
  const event = payload as AgentHubEvent;
  const eventId = `evt_${event.uuid || Date.now()}_${event.turn || segments.length}`;

  if (event.type === "TOOL") {
    const segment = ensureWritableSegment(segments, eventId);
    appendToolToSegmentEvents(
      segment,
      toToolStreamEvent(event as unknown as AgenthubInlineToolEvent),
    );
    return finalizeSegments(originMessage, segments, false);
  }

  if (event.finished) {
    const segment = ensureWritableSegment(segments, eventId);
    appendSegmentText(segment, event.text || "");
    segment.finished = true;
    return finalizeSegments(originMessage, segments, true);
  }

  if (event.type === "stream") {
    const { visibleText, toolEvents } = extractInlineToolEvents(
      event.text || "",
    );
    const segment = ensureWritableSegment(segments, eventId);
    if (visibleText || toolEvents.length > 0) {
      segment.events = ensureAssistantStartEvent(
        segment.events || [],
        segment.id,
      );
    }
    appendSegmentText(segment, visibleText);
    toolEvents.forEach((toolEvent) => {
      appendToolToSegmentEvents(segment, toolEvent);
    });
    return finalizeSegments(originMessage, segments, false);
  }
  return finalizeSegments(originMessage, segments, false);
};

/**
 * 当前函数处理了 5 种内容的分流、多段推理的管理、 3种异常场景的优雅降级。
 * 每个 if 分支都是一个独立的“状态转换”。
 */
