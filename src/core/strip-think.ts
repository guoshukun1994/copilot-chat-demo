/**
 * Think 标签实时清洗
 * 难点：流式输出中 think 标签可能随时不闭合！
 * 三种场景：
 *  a. 正常闭合：<think>推理中 -》正则直接删除
 *  b. 未闭合：<think>推理中...(模型还在 thinking) -> indexOf 截断
 *  c. 跨 chunk: 一个 chunk 到 <thin，下一个 chunk 到 k> 推理... -> 由上层 buffer 处理
 */
export const stripThinkContent = (text: string): string => {
  // 1. 删除已闭合的 <think> 块：必须匹配整个块，而不是单个字符
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, "");

  // 2. 处理未闭合的 <think>（流式输出中最常见）
  const unclosedIdx = result.indexOf("<think>");
  if (unclosedIdx !== -1) {
    result = result.slice(0, unclosedIdx);
  }

  // 3. 清理可能残留的前导换行
  return result.replace(/^\n+/, "");
};

/**
 * 为什么要单独一个 extract 函数？
 * 因为 stripThinkContent 要在每个 SSE chunk 到达时对累积的 'rawText' 调用。如果 think标签尚未闭合，`<think>推理中...`
 * 后面的所有文字都属于推理过程,不能展示给用户.
 */
