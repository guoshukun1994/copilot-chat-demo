/**
 * AgenthubStreamAdapter - 白噪声过滤 + 事件适配
 *
 * 核心亮点：appendVisibleText 的白噪声过滤
 *
 * 问题：流式输出中，有些 chunk 只包含 think 标签内容，清洗后可见文本长度不变，
 * 但如果还 emit,会触发 React re-render,而 UI 上没有任何视觉变化--这就是“白噪声”。
 *
 * 解决：比较 visibleText.length 和 emittedText.length,
 * 仅在有新的可见内容时才 emit 新 chunk.
 */

import { isVisibleContentType } from "./constants";
import {
  extractInlineToolEvents,
  parseMaybeJson,
  toToolStreamEvent,
} from "./extract-inline-tool-events";
import { stripThinkContent } from "./strip-think";
import type {
  AgentHubEvent,
  AgenthubInlineToolEvent,
  StreamChatEnvelope,
} from "./types";

export interface AdapterChunk {
  type: "chunk" | "tool_call" | "done";
  output: string;
  contentType: string;
  reqId: string;
}

export class AgenthubStreamAdapter {
  private rawText = "";
  private emittedText = "";
  private eventIndex = 0;

  accept(event: AgentHubEvent | StreamChatEnvelope): AdapterChunk[] {
    this.eventIndex += 1;

    if ("data" in event && event.data) {
      return this.acceptStreamChatEnvelope(event as StreamChatEnvelope);
    }

    const agentEvent = event as AgentHubEvent;
    const reqId = `evt_${agentEvent.uuid || this.eventIndex}_${agentEvent.turn || this.eventIndex}`;

    if (agentEvent.finished) {
      return [
        ...this.appendVisibleText(agentEvent.text || "", reqId),
        { type: "done", output: "", contentType: "stream", reqId },
      ];
    }

    if (agentEvent.type === "stream") {
      const { visibleText, toolEvents } = extractInlineToolEvents(
        agentEvent.text || "",
      );
      return [
        ...this.appendVisibleText(visibleText, reqId),
        ...toolEvents.map((toolEvent) => ({
          type: "tool_call" as const,
          output: JSON.stringify({
            id: toolEvent.id,
            name: toolEvent.data?.name || toolEvent.content,
            input: toolEvent.data?.input,
            output: toolEvent.data?.output,
            running: toolEvent.data?.running,
            success: toolEvent.data?.success,
          }),
          contentType: "tool_call",
          reqId: toolEvent.id,
        })),
      ];
    }

    if (agentEvent.type === "template" && agentEvent.content?.body) {
      const body = agentEvent.content.body;
      if (body.tool_name && body.args !== undefined) {
        return [
          {
            type: "tool_call",
            output: JSON.stringify({
              id: reqId,
              name: body.tool_name,
              input: body.args,
            }),
            contentType: "tool_call",
            reqId,
          },
        ];
      }
    }

    return [];
  }

  private acceptStreamChatEnvelope(event: StreamChatEnvelope): AdapterChunk[] {
    const data = event.data;
    if (!data) return [];

    const content = data.contents?.[0];
    const reqId = data.reqId || data.chatId || `evt_${this.eventIndex}`;

    if (data.finished === true || data.msgType === "CHAT_EXIT") {
      const output = isVisibleContentType(content?.contentType)
        ? content?.content?.text || ""
        : "";
      return [
        ...this.appendVisibleText(output, reqId),
        {
          type: "done",
          output: "",
          contentType: content?.contentType || "stream",
          reqId,
        },
      ];
    }

    if (content?.contentType === "thinking") return [];

    if (
      content?.contentType === "thought" &&
      content.content?.type === "TOOL"
    ) {
      const parsed = parseMaybeJson(content.content.text) as
        | AgenthubInlineToolEvent
        | undefined;
      if (parsed?.type === "TOOL") {
        const streamEvent = toToolStreamEvent(parsed);
        return [
          {
            type: "tool_call",
            output: JSON.stringify({
              id: streamEvent.id,
              name: streamEvent.data?.name || streamEvent.content,
              input: streamEvent.data?.input,
              output: streamEvent.data?.output,
              running: streamEvent.data?.running,
              success: streamEvent.data?.success,
            }),
            contentType: "tool_call",
            reqId: streamEvent.id,
          },
        ];
      }
      return [];
    }

    const output = content?.content?.text || "";
    if (!output || !isVisibleContentType(content?.contentType)) return [];

    return this.appendVisibleText(output, reqId);
  }

  /**
   * 白噪声过滤的核心方法
   *
   * 累积 rawText → 清洗得到 visibleText → 和上一次比较
   * 如果长度没增长（说明这个 chunk 只增加了 think 内容），不 emit
   */
  private appendVisibleText(text: string, reqId: string): AdapterChunk[] {
    if (text) this.rawText += text;
    const visibleText = stripThinkContent(this.rawText);

    // 核心判断：可见文本长度没增长 → 白噪声，不 emit
    if (visibleText.length <= this.emittedText.length) return [];

    // 只 emit 新增部分（增量式更新）
    const output = visibleText.slice(this.emittedText.length);
    this.emittedText = visibleText;

    return [{ type: "chunk", output, contentType: "stream", reqId }];
  }
}
