/**
 * DeployCheck Agent — 先调用工具，再输出诊断结果
 */
import type { SSEChunk } from "../sse-helpers";
import { splitByChar } from "./deep-think";

export const generateDeployCheckResponse = (query: string): SSEChunk[] => {
  const frames: SSEChunk[] = [];
  const reqId = `req_${Date.now()}`;
  const sessionId = `session_${Date.now()}`;

  // 1. 工具调用开始 — 查询部署日志
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deploy_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "查询部署日志",
              running: true,
              executeId: "tool_deploy_log_1",
            },
          },
        },
      ],
    },
  });

  // 2. 工具调用完成
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deploy_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "查询部署日志",
              running: false,
              success: true,
              executeId: "tool_deploy_log_1",
              outputs: JSON.stringify({
                logs: "OOM Killed\nContainer exceeded memory limit",
                exitCode: 137,
              }),
            },
          },
        },
      ],
    },
  });

  // 3. 第二个工具 — 查询资源配额
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deploy_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "查询资源配额",
              running: true,
              executeId: "tool_resource_quota_1",
            },
          },
        },
      ],
    },
  });

  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deploy_check",
      contents: [
        {
          contentType: "thought",
          content: {
            type: "TOOL",
            event: {
              type: "TOOL",
              name: "查询资源配额",
              running: false,
              success: true,
              executeId: "tool_resource_quota_1",
              outputs: JSON.stringify({
                cpu: "4核",
                memory: "8GB",
                gpu: "1×A10",
                requestMemory: "16GB",
              }),
            },
          },
        },
      ],
    },
  });

  // 4. 诊断结果
  const answer = [
    "✅ **部署诊断工具调用成功**",
    "",
    "根据日志分析，部署失败的原因是：",
    "",
    "**OOM Killed（内存溢出）**",
    "",
    "- 容器请求内存：16GB",
    "- 实际配额：8GB",
    "- 退出码：137",
    "",
    "**解决方案：**",
    "",
    "1. `降低内存请求` — 将 `resources.memory` 改为 `8GB` 以下",
    "2. `申请更高配额` — 联系管理员提升资源配额",
    "3. `优化模型加载` — 使用模型分片加载，减少峰值内存",
    "",
    "```yaml",
    "resources:",
    "  memory: 8Gi",
    "  cpu: 4",
    "  gpu: 1",
    "```",
    "",
    "> 修改配置后重新部署即可。",
  ].join("\n");

  splitByChar(answer).forEach((token: string) => {
    frames.push({
      success: true,
      data: {
        reqId,
        sessionId,
        agentId: "deploy_check",
        msgType: "CHAT",
        contents: [{ contentType: "stream", content: { text: token } }],
      },
    });
  });

  // 5. 结束帧
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deploy_check",
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "stop",
    },
  });

  return frames;
};
