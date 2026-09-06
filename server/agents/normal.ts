/**
 * Normal Agent - 通用问答 Mock
 * 最基础的流失场景：纯文本流式输出，无推理链，无工具调用
 */
import type { SSEChunk } from "../sse-helpers";

export const generateNoramlResponse = (query: string): SSEChunk[] => {
  const answer = getNoramlAnswer(query);
  const frames: SSEChunk[] = [];
  const reqId = `req_${Date.now()}`;
  const sessionId = `session_${Date.now()}`;

  const tokens = splitTokens(answer);

  tokens.forEach((token) => {
    frames.push({
      success: true,
      data: {
        reqId,
        sessionId,
        agentId: "normal",
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
      agentId: "normal",
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "stop",
    },
  });
  return frames;
};

function getNoramlAnswer(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("你好") || q.includes("hello")) {
    return "你好！我是一个 AIS 智能助手，我可以帮你解答平台使用问题、诊断部署和调用失败等问题。请问有什么可以帮你的？";
  }
  if (q.includes("功能") || q.includes("能做什么")) {
    return "作为 AIS 智能助手，我可以帮你：\n\n1. **平台使用引导** - 解答平台功能和使用方法\n2. **部署诊断** 自动分析部署失败原因并给出解决方案\n3. **调用失败排查** - 根据 traceId 诊断API调用失败原因\n4. **深度思考** - 对复杂问题进行逐步推理\n\n你可以直接描述你的问题，我会尽力帮你解答！";
  }
  return `关于"${query}"，这是一个很好的问题。\n\n在AIS平台中，你可以通过以下方式解决：\n\n1. 查阅平台文档获取详细信息\n2. 使用部署诊断工具检查部署状态\n3. 使用调用失败诊断工具排查API问题\n\n如果需要更深入的分析，可以切换到"深度思考"模式。`;
}

/** 将文本拆成 token（中文按字，英文按词，markdown 语法符号独立） */
function splitTokens(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === undefined) break;
    if (ch === "*" || ch === "#" || ch === "`" || ch === "\n") {
      let j = i + 1;
      const next = text[j];
      if (ch === "*" && next === "*") j++;
      if (ch === "`" && next === "`") {
        j++;
        if (text[j] === "`") j++;
      }
      tokens.push(text.slice(i, j));
      i = j;
    } else if (/[一-鿿]/.test(ch)) {
      tokens.push(ch);
      i++;
    } else {
      let j = i;
      while (j < text.length) {
        const cj = text[j];
        if (cj === undefined || /[一-鿿]/.test(cj) || cj === "*" || cj === "\n")
          break;
        j++;
      }
      tokens.push(text.slice(i, j));
      i = j;
    }
  }
  return tokens;
}
