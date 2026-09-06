/**
 * SSE 帧封装工具
 */
import type { Response } from "express";

export type SSEChunk = Record<string, unknown>;

/** 设置 SSE 响应头 */
export const setSSEHeaders = (res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 禁用 nginx 的响应缓存，确保 SSE 实时推送
  res.flushHeaders(); // 立即发送响应头，确保客户端可以立即接收 SSE 数据
};

/** 发送一个 SSE 帧 */
export const sendSSEChunk = (res: Response, chunk: SSEChunk) => {
  const data = JSON.stringify(chunk);
  res.write(`data: ${data}\n\n`);
};

/** 发送 SSE 结束信号 */
export const sendSSEDone = (res: Response) => {
  res.write("data: [DONE]\n\n");
  res.end();
};

/** 模拟流式输出 - 逐 token 发送 */
export const streamFrames = async (
  res: Response,
  frames: SSEChunk[],
  tokenDelay: () => number = () => 30 + Math.random() * 50,
) => {
  for (const frame of frames) {
    sendSSEChunk(res, frame);
    await delay(tokenDelay());
  }
  sendSSEDone(res);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
