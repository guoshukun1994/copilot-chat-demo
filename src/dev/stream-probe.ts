/**
 * 流式渲染探针（仅开发环境）
 *
 * 量化"逐 SSE 帧 setState → 逐帧渲染"的开销：
 *  - storeWrites   store.messages 引用变化次数（≈ setState 次数）
 *  - listRenders   ChatView 渲染次数（组件内一行埋点上报）
 *  - bubbleRenders MessageBubble 渲染总次数（同上）
 * 流结束时在控制台打印汇总，用于改动前后对比。
 */
import { useChatStore } from "../store/chat-store";

export interface ProbeStats {
  storeWrites: number;
  listRenders: number;
  bubbleRenders: number;
  startedAt: number;
  endedAt: number;
  streaming: boolean;
  /** 流式期间实测帧率相关 */
  frames: number;
  worstFrameGap: number;
  longTasks: number;
  maxTask: number;
}

const stats: ProbeStats = {
  storeWrites: 0,
  listRenders: 0,
  bubbleRenders: 0,
  startedAt: 0,
  endedAt: 0,
  streaming: false,
  frames: 0,
  worstFrameGap: 0,
  longTasks: 0,
  maxTask: 0,
};

export const getProbeStats = (): ProbeStats => ({ ...stats });

export const resetProbe = () => {
  stats.storeWrites = 0;
  stats.listRenders = 0;
  stats.bubbleRenders = 0;
  stats.startedAt = 0;
  stats.endedAt = 0;
  stats.streaming = false;
  stats.frames = 0;
  stats.worstFrameGap = 0;
  stats.longTasks = 0;
  stats.maxTask = 0;
};

declare global {
  interface Window {
    __streamProbe?: { list: () => void; bubble: () => void };
  }
}

const printSummary = () => {
  const elapsed = stats.endedAt - stats.startedAt;
  const rate =
    elapsed > 0 ? (stats.storeWrites / (elapsed / 1000)).toFixed(0) : "-";
  const amplify =
    stats.listRenders > 0
      ? (stats.bubbleRenders / stats.listRenders).toFixed(1)
      : "-";
  console.log(
    `[StreamProbe] 流结束：store 写入 ${stats.storeWrites} 次（${rate}/s），` +
      `列表渲染 ${stats.listRenders} 次，气泡渲染 ${stats.bubbleRenders} 次` +
      `（放大 ${amplify}x），耗时 ${(elapsed / 1000).toFixed(1)}s`,
  );
};

let installed = false;

// ---- 帧率观测：rAF 计数 = 浏览器实际刷新的次数，最差帧间隔 = 最大一次卡顿 ----
let rafOn = false;
let lastTick = 0;
const frameLoop = () => {
  const n = performance.now();
  if (lastTick) stats.worstFrameGap = Math.max(stats.worstFrameGap, n - lastTick);
  lastTick = n;
  stats.frames++;
  if (rafOn) requestAnimationFrame(frameLoop);
};
const startFrameWatch = () => {
  if (rafOn) return;
  rafOn = true;
  lastTick = 0;
  requestAnimationFrame(frameLoop);
};
const stopFrameWatch = () => {
  rafOn = false;
};

// ---- 长任务观测：单次执行超过 50ms 的任务会阻塞输入响应 ----
const installLongtaskWatch = () => {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        stats.longTasks++;
        if (e.duration > stats.maxTask) stats.maxTask = e.duration;
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    // 老浏览器不支持 longtask，忽略
  }
};

export const installProbe = () => {
  if (installed) return;
  installed = true;
  installLongtaskWatch();
  window.__streamProbe = {
    list: () => {
      stats.listRenders++;
    },
    bubble: () => {
      stats.bubbleRenders++;
    },
  };
  useChatStore.subscribe((state, prev) => {
    if (state.isRequesting && !prev.isRequesting) {
      stats.startedAt = performance.now();
      stats.streaming = true;
      startFrameWatch();
    }
    if (state.messages !== prev.messages) {
      stats.storeWrites++;
    }
    if (!state.isRequesting && prev.isRequesting) {
      stats.endedAt = performance.now();
      stats.streaming = false;
      stopFrameWatch();
      if (stats.startedAt) printSummary();
    }
  });
};
