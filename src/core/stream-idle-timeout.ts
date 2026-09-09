/**
 * 流空闲超时守卫 - 包装 Response.body 为带超时的 ReadableStream
 * 核心设计：不是"总超时" 而是 "空闲超时"!
 * 为什么不用总超时？
   LLM 流式输出可能持续数分钟（DeepThink 推理)
   如果设 2min 总超时，长推理会被误杀
   空闲超时只关心“服务器是否还活着”--60s 内来任何一个字节都算活着
--双重超时：
    空闲超时（60s)： 每个 chunk 到达时重置计时器
    绝对超时（10min): 不管有没有数据都终止（防运行环境泄露）
 */
const DEFAULT_IDLE_TIMEOUT_MS = 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 10 * 60 * 1000;

const createIdleTimeoutError = (timeoutMs: number) =>
  new Error(`Stream idle timeout after ${timeoutMs}ms`);

export const withStreamIdleTimeout = (
  response: Response,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
): Response => {
  if (!response.body || timeoutMs <= 0) {
    return response;
  }

  const reader = response.body.getReader();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let absoluteTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const streamStartedAt = Date.now();

  const clearIdleTimer = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const clearAbsoluteIdleTimer = () => {
    if (absoluteTimeoutId !== undefined) {
      clearTimeout(absoluteTimeoutId);
      absoluteTimeoutId = undefined;
    }
  };

  const settle = () => {
    settled = true;
    clearIdleTimer();
    clearAbsoluteIdleTimer();
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const resetIdleTimer = () => {
        clearIdleTimer();
        timeoutId = setTimeout(() => {
          if (settled) return;
          settle();
          const error = createIdleTimeoutError(timeoutMs);
          console.warn("[Copilot] stream idle timeout", { timeoutMs });
          reader.cancel(error).catch(() => undefined);
          controller.error(error);
        }, timeoutMs);
      };

      absoluteTimeoutId = setTimeout(() => {
        if (settled) return;
        settle();
        const elapsed = Date.now() - streamStartedAt;
        console.warn("[Copilot] stream absolute timeout", { elapsed });
        reader
          .cancel(new Error("Stream absolute timeout"))
          .catch(() => undefined);
        controller.error(
          new Error("会话已超过10分钟， 运行环境已释放，请开始新对话"),
        );
      });

      const pump = async () => {
        resetIdleTimer();
        try {
          while (!settled) {
            const { done, value } = await reader.read();
            if (settled) return;
            if (done) {
              settle();
              controller.close();
              return;
            }
            resetIdleTimer();
            if (value) controller.enqueue(value);
          }
        } catch (error) {
          if (settled) return;
          settle();
          controller.error(error);
        }
      };

      pump();
    },

    cancel(reason) {
      settle();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};

export { ABSOLUTE_TIMEOUT_MS };
