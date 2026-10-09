/** Mock SSE Server - 模拟 4 种 Agent 的流式响应 */

import express from "express";
import cors from "cors";
import { setSSEHeaders, streamFrames } from "./sse-helpers";
import { generateNoramlResponse } from "./agents/normal";
import { generateDeepThinkResponse } from "./agents/deep-think";
import { generateDeployCheckResponse } from "./agents/deploy-check";
import { generateCalledFailCheckResponse } from "./agents/called-fail-check";
import { generateStressResponse } from "./agents/stress";

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
