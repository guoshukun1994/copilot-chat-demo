/**
 * 火山方舟 Agent - 真实大模型流式转发(Responses 协议)
 *
 * 与 mock agent 的区别:mock 是把预制文本按延迟重放(streamFrames),
 * 这里是边读上游 SSE 边转发,首 token 延迟 = 网络 + 模型推理时间。
 *
 * 上游每个事件的 data 载荷都带 type 字段,关心这四种:
 * - response.reasoning_summary_text.delta:推理过程增量(映射为 thinking 帧)
 * - response.output_text.delta:可见回答增量(映射为 stream 帧)
 * - response.completed:正常结束
 * - response.failed / error:失败,取其中的 message 提示给用户
 *
 * 问答模式通过 thinking:{type:"disabled"} 关闭推理,直接出正文;
 * 推理模式保持开启,先出思考过程再出回答。
 *
 * 配置(根目录 .env):
 * - ARK_API_KEY:火山方舟 API Key
 * - ARK_BASE_URL:接口地址,默认 https://ark.cn-beijing.volces.com/api/v3
 * - ARK_MODEL_CHAT / ARK_MODEL_REASONER:两个 Agent 分别使用的模型 ID
 */

import type { Response } from "express";
import { sendSSEChunk, sendSSEDone } from "../sse-helpers";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export type ArkMode = "chat" | "reasoner";

/** 方舟 Responses 流式事件中 data 载荷的结构(只列出用到的字段) */
interface ArkResponseEvent {
  type?: string;
  delta?: string;
  code?: string;
  message?: string;
  response?: {
    status?: string;
    error?: { code?: string; message?: string };
  };
}

/** 按行解析上游 SSE 流,逐帧回调 data 载荷;回调返回 false 表示提前结束 */
const readUpstreamSSE = async (
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => boolean | void,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 事件以空行分隔,逐个取出完整事件
      let sepIndex = buffer.indexOf("\n\n");
      while (sepIndex !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        for (const line of rawEvent.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (onData(data) === false) return;
        }
        sepIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
};

/** 提取上游错误响应中的可读信息 */
const readUpstreamError = async (
  resp: globalThis.Response,
): Promise<string> => {
  try {
    const payload = (await resp.json()) as { error?: { message?: string } };
    return payload?.error?.message || `HTTP ${resp.status}`;
  } catch {
    return `HTTP ${resp.status}`;
  }
};

/** 上游调用失败时,把原因作为可见文本流给前端,并补结束帧让消息正常收尾 */
const emitUpstreamError = (
  res: Response,
  base: { reqId: string; sessionId: string; agentId: string },
  detail: string,
) => {
  sendSSEChunk(res, {
    success: true,
    data: {
      ...base,
      msgType: "CHAT",
      contents: [
        {
          contentType: "stream",
          content: {
            text: `模型调用失败:${detail}\n\n请检查服务端 .env 中的 ARK_API_KEY,并确认所用模型已在火山方舟控制台开通(console.volcengine.com/ark),或切回其他 mock Agent。`,
          },
        },
      ],
    },
  });
  sendSSEChunk(res, {
    success: true,
    data: {
      ...base,
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "error",
    },
  });
};

export const streamArkResponse = async (
  res: Response,
  query: string,
  mode: ArkMode,
): Promise<void> => {
  const apiKey = process.env.ARK_API_KEY;
  const baseURL = process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
  const fallbackModel = "doubao-seed-2-1-lite-260915";
  const model =
    mode === "reasoner"
      ? process.env.ARK_MODEL_REASONER || fallbackModel
      : process.env.ARK_MODEL_CHAT || fallbackModel;
  const reqId = `req_${Date.now()}`;
  const sessionId = `session_${Date.now()}`;
  const agentId = mode === "reasoner" ? "ark_reasoner" : "ark_chat";
  const base = { reqId, sessionId, agentId };

  try {
    if (!apiKey) {
      emitUpstreamError(res, base, "未配置 ARK_API_KEY");
      return;
    }

    const resp = await fetch(`${baseURL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        thinking: { type: mode === "reasoner" ? "enabled" : "disabled" },
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: query }],
          },
        ],
      }),
    });

    if (!resp.ok || !resp.body) {
      emitUpstreamError(res, base, await readUpstreamError(resp));
      return;
    }

    let finishReason: string | null = null;
    let failedMessage: string | null = null;
    await readUpstreamSSE(resp.body, (data) => {
      let payload: ArkResponseEvent;
      try {
        payload = JSON.parse(data);
      } catch {
        return; // 跳过无法解析的帧,不中断流
      }

      if (payload.type === "response.reasoning_summary_text.delta" && payload.delta) {
        sendSSEChunk(res, {
          success: true,
          data: {
            ...base,
            msgType: "CHAT_CoT",
            contents: [
              {
                contentType: "thinking",
                content: { text: payload.delta },
              },
            ],
          },
        });
      }
      if (payload.type === "response.output_text.delta" && payload.delta) {
        sendSSEChunk(res, {
          success: true,
          data: {
            ...base,
            msgType: "CHAT",
            contents: [
              {
                contentType: "stream",
                content: { text: payload.delta },
              },
            ],
          },
        });
      }
      if (payload.type === "response.completed") {
        finishReason = "stop";
        return false; // 正常结束,不再继续读
      }
      if (payload.type === "response.failed" || payload.type === "error") {
        failedMessage =
          payload.response?.error?.message || payload.message || "模型调用失败";
        return false;
      }
    });

    if (failedMessage) {
      emitUpstreamError(res, base, failedMessage);
      return;
    }

    // 结束帧:协议与 mock agent 保持一致
    sendSSEChunk(res, {
      success: true,
      data: {
        ...base,
        msgType: "CHAT_EXIT",
        finished: true,
        finishReason: finishReason || "stop",
      },
    });
  } catch (error) {
    // 网络异常 / 流中断:补一条错误说明(连接已断开时写入会失败,忽略即可)
    try {
      emitUpstreamError(
        res,
        base,
        error instanceof Error ? error.message : "网络异常",
      );
    } catch {
      // 连接已断开,无法写入
    }
  } finally {
    sendSSEDone(res);
  }
};
