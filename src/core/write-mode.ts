/**
 * 流式写入模式（对比实验开关）
 *
 * - raw：每个 SSE 帧到达就立刻写 store（基线行为）
 * - frame：合帧写入，一帧内无论来多少个帧，渲染前只写一次最新快照
 *
 * 初始值优先取 URL ?write=frame|raw，其次 localStorage，默认 raw。
 * 探针面板切换后会写入 localStorage，刷新页面重跑压测时模式不丢。
 */

export type WriteMode = "raw" | "frame";

const STORAGE_KEY = "copilot_write_mode";

const readInitialMode = (): WriteMode => {
  const fromUrl = new URLSearchParams(window.location.search).get("write");
  if (fromUrl === "frame" || fromUrl === "raw") return fromUrl;
  return window.localStorage.getItem(STORAGE_KEY) === "frame"
    ? "frame"
    : "raw";
};

let currentMode: WriteMode = readInitialMode();
const listeners = new Set<(mode: WriteMode) => void>();

export const getWriteMode = (): WriteMode => currentMode;

export const setWriteMode = (mode: WriteMode) => {
  if (mode === currentMode) return;
  currentMode = mode;
  window.localStorage.setItem(STORAGE_KEY, mode);
  listeners.forEach((fn) => fn(mode));
};

export const subscribeWriteMode = (fn: (mode: WriteMode) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
