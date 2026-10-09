/**
 * 压测 Agent - 高速率流式输出
 *
 * 用途：配合渲染探针（src/dev/StreamProbe）量化"逐帧 setState"的渲染开销
 * 触发方式：发送包含"压测"二字的消息（探针在 ?stress=1 时会自动发）
 */
import type { SSEChunk } from "../sse-helpers";

/** 压测回答：上千 token 的长 markdown（标题/列表/代码块全覆盖），rounds 控制重复轮数 */
const buildStressAnswer = (rounds: number): string => {
  const parts: string[] = [
    "# 流式渲染压测报告\n\n",
    "这是一段用于压测的长文本，模拟真实大模型的高速输出。\n\n",
  ];
  for (let r = 1; r <= rounds; r++) {
    parts.push(`\n## 第 ${r} 轮指标\n\n`);
    for (let i = 1; i <= 12; i++) {
      parts.push(
        `${i}. **指标项 ${i}**：渲染次数应当被合帧收敛，而不是随 token 数线性增长，否则帧预算会被迅速击穿。\n`,
      );
    }
    parts.push(
      "\n```ts\nconst batch = (fn) => {\n  let id = 0;\n  return (v) => {\n    if (id) return;\n    id = requestAnimationFrame(() => { id = 0; fn(v); });\n  };\n};\n```\n\n",
    );
  }
  parts.push("以上，压测结束。");
  return parts.join("");
};

/** 拆分 token：英文/数字按连续段，其余逐字符（与 normal.ts 的粒度近似） */
const splitTokens = (text: string): string[] => {
  const tokens: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      tokens.push(buf);
      buf = "";
    }
  };
  for (const ch of text) {
    if (/[a-zA-Z0-9_]/.test(ch)) {
      buf += ch;
      continue;
    }
    flush();
    tokens.push(ch);
  }
  flush();
  return tokens;
};

/** 生成压测帧序列，rounds 越大流越长（1 轮 ≈ 770 帧 ≈ 1.8s） */
export const generateStressResponse = (rounds = 1): SSEChunk[] => {
  const reqId = `req_stress_${Date.now()}`;
  const sessionId = `session_stress_${Date.now()}`;
  const frames: SSEChunk[] = splitTokens(buildStressAnswer(rounds)).map((token) => ({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "normal",
      msgType: "CHAT",
      contents: [{ contentType: "stream", content: { text: token } }],
    },
  }));
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "normal",
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "stop",
    },
  });
  return frames;
};
