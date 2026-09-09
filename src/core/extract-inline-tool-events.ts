/**
 * 从流式文本中提取嵌入的工具调用 JSON
 * 场景：模型流式输出中可能突然嵌入；
 *  {"type":"TOOL","name":"查询部署日志","inputs":{...},"running":true}
    这些 JSON 和普通文本混在一起，需要准确提取
    为什么不能只用正则 /{.*?}/ ?
    非贪婪正则遇到嵌套 JSON 会提前截断
    遇到字符串内的{ } 会误匹配
    所以必须用 findJsonObjectEnd 逐字符扫描
 */
import { findJsonObjectEnd } from "./find-json-objet-end";
import type { AgenthubInlineToolEvent, StreamEvent } from "./types";
import { StreamEventType } from "./types";

/** 将工具事件转换为 StreamEvent */
const toToolStreamEvent = (toolEvent: AgenthubInlineToolEvent): StreamEvent => {
  const toolName = toolEvent.name || toolEvent.tool || "工具";
  const eventId = toolEvent.executeId || `${toolName}_${Date.now()}`;
  const isDone = toolEvent.running === false;

  return {
    id: isDone ? `tool_${eventId}_done` : `tool_${eventId}`,
    type: StreamEventType.AsistantToolUse,
    content: toolName,
    data: {
      name: toolName,
      running: toolEvent.running,
      success: toolEvent.success,
      ...(toolEvent.inputs !== undefined ? { input: toolEvent.inputs } : {}),
      ...(toolEvent.outputs !== undefined ? { input: toolEvent.outputs } : {}),
    },
  };
};

/** 安全 JSON 解析（typeof guard) */
const parseMaybeJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export interface ExtractedResult {
  visibleText: string;
  toolEvents: StreamEvent[];
}

/** 从混合文本中提取内嵌工具调用事件 */
export const extractInlineToolEvents = (text: string): ExtractedResult => {
  const toolEvents: StreamEvent[] = [];
  let visibleText = "";
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf("{", cursor);
    if (start === -1) {
      visibleText += text.slice(cursor);
      break;
    }

    const end = findJsonObjectEnd(text, start);

    if (end === -1) {
      // 不完整的 JSON，保留为可见文本
      visibleText += text.slice(cursor);
      break;
    }

    const jsonText = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(jsonText) as AgenthubInlineToolEvent;
      if (parsed?.type === "TOOL") {
        visibleText += text.slice(cursor, start);
        toolEvents.push(toToolStreamEvent(parsed));
        cursor = end + 1;
        continue;
      }
    } catch {
      // JSON 解析失败， 当作普通文本
    }

    // 不是工具事件 JSON, 保留为可见文本
    visibleText += text.slice(cursor, end + 1);
    cursor = end + 1;
  }
  return { visibleText, toolEvents };
};

export { toToolStreamEvent, parseMaybeJson };
