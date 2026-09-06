/**
 * CalledFailCheck Agent — 接收结构化参数，调用 RAG 工具检索
 */
import type { SSEChunk } from "../sse-helpers";
import { splitByChar } from "./deep-think";

interface CalledFailCheckParams {
  query: string;
  traceId?: string;
  ip?: string;
  time?: string;
}

export const generateCalledFailCheckResponse = (
  params: CalledFailCheckParams,
): SSEChunk[] => {
  const frames: SSEChunk[] = [];
  const reqId = `req_${Date.now()}`;
  const sessionId = `session_${Date.now()}`;

  // 1. 工具调用 — RAG 检索
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "called_fail_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "检索调用日志",
              running: true,
              executeId: "tool_rag_call_log_1",
              inputs: JSON.stringify({
                traceId: params.traceId || "未提供",
                ip: params.ip || "未提供",
                time: params.time || "未提供",
              }),
            },
          },
        },
      ],
    },
  });

  // 2. RAG 检索完成
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "called_fail_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "检索调用日志",
              running: false,
              success: true,
              executeId: "tool_rag_call_log_1",
              outputs: JSON.stringify({
                statusCode: 500,
                errorType: "ModelNotReady",
                message: "Model is not ready for inference",
              }),
            },
          },
        },
      ],
    },
  });

  // 3. 诊断结果
  const traceId = params.traceId || "N/A";
  const answer = [
    "✅ **调用失败诊断工具调用成功**",
    "",
    `根据TraceId \`${traceId}\` 的调用日志分析：`,
    "",
    "**错误类型：ModelNotReady**",
    "",
    "- HTTP状态码：500",
    "- 错误信息：Model is not ready for inference",
    "",
    "**根因分析：**",
    "",
    "模型服务尚未完成初始化，可能原因：",
    "1. 模型正在加载中，首次请求过早",
    "2. 模型因OOM被重启，尚未恢复",
    "3. GPU资源不足，模型加载超时",
    "",
    "**解决方案：**",
    "",
    "1. `等待模型就绪` — 通常需要1-3分钟，稍后重试",
    '2. `检查模型状态` — 在模型详情页查看是否为"运行中"',
    "3. `增加健康检查` — 在调用前先请求 `/health` 接口",
    "",
    "```python",
    "import time",
    "for i in range(10):",
    '    resp = requests.get(f"{endpoint}/health")',
    "    if resp.status_code == 200:",
    "        break",
    "    time.sleep(30)",
    "```",
    "",
    "> 这是调用失败最常见的原因之一，通常等待或重试即可解决。",
  ].join("\n");

  splitByChar(answer).forEach((token: string) => {
    frames.push({
      success: true,
      data: {
        reqId,
        sessionId,
        agentId: "called_fail_check",
        msgType: "CHAT",
        contents: [{ contentType: "stream", content: { text: token } }],
      },
    });
  });

  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "called_fail_check",
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "stop",
    },
  });

  return frames;
};
