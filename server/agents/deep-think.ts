/**
 * DeepThink Agent — 先输出推理链(thinking)，再输出可见回答(stream)
 */
import type { SSEChunk } from "../sse-helpers";

export const generateDeepThinkResponse = (query: string): SSEChunk[] => {
  const frames: SSEChunk[] = [];
  const reqId = `req_${Date.now()}`;
  const sessionId = `session_${Date.now()}`;

  // 1. 推理阶段
  const thinkText = `让我来仔细分析这个问题："${query}"。首先，我需要理解问题的核心诉求。用户可能遇到了平台使用上的困惑。让我从几个角度来思考：1. 问题的具体场景是什么？2.
  平台提供了哪些相关功能？3. 最可能的解决方案是什么？综合以上分析，我认为应该从实际操作角度给出指导。`;
  const thinkTokens = splitByChar(thinkText);
  thinkTokens.forEach((token) => {
    frames.push({
      success: true,
      data: {
        reqId,
        sessionId,
        agentId: "deep_think",
        msgType: "CHAT_CoT",
        contents: [{ contentType: "thinking", content: { text: token } }],
      },
    });
  });

  // 2. 回答阶段
  const answerText = `经过深入分析，关于"${query}"，我的结论如下：\n\n**核心要点：**\n\n1. 首先需要确认问题的具体场景和上下文\n2.
  根据平台功能模块，定位到对应的解决方案\n3. 如果是部署相关问题，建议使用部署诊断工具\n4. 如果是API调用问题，建议使用调用失败诊断工具\n\n**建议操作步骤：**\n\n-
  步骤一：确认问题类型\n- 步骤二：选择合适的诊断工具\n- 步骤三：根据诊断结果执行修复\n\n> 以上是经过深度推理后的建议，如需更详细的帮助请继续提问。`;
  const answerTokens = splitByChar(answerText);
  answerTokens.forEach((token) => {
    frames.push({
      success: true,
      data: {
        reqId,
        sessionId,
        agentId: "deep_think",
        msgType: "CHAT",
        contents: [{ contentType: "stream", content: { text: token } }],
      },
    });
  });

  // 3. 结束帧
  frames.push({
    success: true,
    data: {
      reqId,
      sessionId,
      agentId: "deep_think",
      msgType: "CHAT_EXIT",
      finished: true,
      finishReason: "stop",
    },
  });

  return frames;
};

/** 中文字符逐字，非中文合并 */
  const splitByChar = (text: string): string[] => {
    const tokens: string[] = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === undefined) break;
      if (/[一-鿿]/.test(ch) || ch === '\n' || ch === '，' || ch === '。' || ch === '、') {
        tokens.push(ch);
        i++;
      } else {
        let j = i;
        while (j < text.length) {
          const cj = text[j];
          if (cj === undefined || /[一-鿿，。、\n]/.test(cj)) break;
          j++;
        }
        tokens.push(text.slice(i, j));
        i = j;
      }
    }
    return tokens;
  };

  export { splitByChar };