/** Mock SSE Server - 模拟 4 种 Agent 的流式响应 + 火山方舟真实模型转发 */

import process from "node:process";
import express from "express";
import cors from "cors";
import { setSSEHeaders, streamFrames } from "./sse-helpers";
import { generateNoramlResponse } from "./agents/normal";
import { generateDeepThinkResponse } from "./agents/deep-think";
import { generateDeployCheckResponse } from "./agents/deploy-check";
import { generateCalledFailCheckResponse } from "./agents/called-fail-check";
import { generateStressResponse } from "./agents/stress";
import { streamArkResponse } from "./agents/ark";

// 加载本地 .env(Node 20.12+ 内置,文件不存在时静默跳过)
try {
  process.loadEnvFile();
} catch {
  // 没有 .env 文件时忽略,方舟 Agent 会提示未配置密钥
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const { query, agentId, sessionId } = req.body;
  console.log(
    `[SSE] Received: agentId=${agentId}, query="${query?.slice(0, 50)}", sessionId=${sessionId}`,
  );

  setSSEHeaders(res);

  try {
    // 压测模式：query 含"压测"时走高速率流
    // 支持"压测 x8 tps50"：x 指定轮数（1 轮 ≈ 1.8s），tps 指定速率（token/s，默认 500）
    if ((query || "").includes("压测")) {
      const m = (query || "").match(/x\s*(\d+)/i);
      const rounds = m ? Math.min(Math.max(parseInt(m[1], 10) || 1, 1), 20) : 1;
      const t = (query || "").match(/tps\s*(\d+)/i);
      const tps = t ? Math.min(Math.max(parseInt(t[1], 10) || 500, 5), 500) : 500;
      await streamFrames(res, generateStressResponse(rounds), () => 1000 / tps);
      return;
    }

    // 火山方舟真实大模型:边读上游边转发,不走 mock 的 streamFrames 重放
    if (agentId === "ark_chat" || agentId === "ark_reasoner") {
      await streamArkResponse(
        res,
        query || "",
        agentId === "ark_reasoner" ? "reasoner" : "chat",
      );
      return;
    }

    let frames;
    switch (agentId) {
      case "deep_think":
        frames = generateDeepThinkResponse(query || "");
        break;
      case "deploy_check":
        frames = generateDeployCheckResponse();
        break;
      case "called_fail_check":
        frames = generateCalledFailCheckResponse({
          query: query || "",
          traceId: "traceId_abc123def456",
          ip: "10.0.1.25",
          time: new Date().toISOString(),
        });
        break;
      default:
        frames = generateNoramlResponse(query || "");
    }
    await streamFrames(res, frames);
  } catch (_error) {
    console.log("[SSE] Error:", _error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Mock SSE Server running at http:/localhost:${PORT}`);
});

/**
 * 测试流式接口
 curl -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"你好","agentId":"normal","sessionId":"demo-1"}'
 */
