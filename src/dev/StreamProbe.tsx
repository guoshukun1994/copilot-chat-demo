/**
 * 流式渲染探针面板（仅开发环境）
 *
 * 吸附在消息对话容器的左侧外边（fixed 定位，不受父级 overflow 裁剪），
 * 实时显示 store 写入 / 列表渲染 / 气泡渲染计数。
 * 通过 Portal 挂到 body 下：push 面板的 will-change/transform 会截获
 * fixed 定位的包含块，Portal 到 body 后坐标才真正相对视口。
 * URL 带 ?stress=1 时自动发送一条"压测"消息，用于改动前后对比。
 * 顶部可切换写入模式：逐 token（基线）vs 合帧（rAF），对比两组数据。
 * 面板自身用 300ms 轮询刷新，不订阅 store，避免干扰被测路径。
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getProbeStats, installProbe, resetProbe } from "./stream-probe";
import {
  getWriteMode,
  setWriteMode,
  subscribeWriteMode,
  type WriteMode,
} from "../core/write-mode";
import { chatBridge } from "../hooks/useChat";
import { useChatStore } from "../store/chat-store";
import type { CopilotMessage } from "../core/types";

const panelBaseStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 9999,
  background: "rgba(0, 0, 0, 0.78)",
  color: "#7CFC00",
  font: "12px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "8px 12px",
  borderRadius: 8,
  pointerEvents: "none",
  whiteSpace: "pre",
};

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  pointerEvents: "auto",
  cursor: "pointer",
  border: active ? "1px solid #7CFC00" : "1px solid #555",
  background: active ? "rgba(124, 252, 0, 0.15)" : "transparent",
  color: active ? "#7CFC00" : "#999",
  font: "11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "1px 8px",
  borderRadius: 4,
});

export const StreamProbe: React.FC = () => {
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<WriteMode>(getWriteMode);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  // 面板宽度由内容决定且基本不变，挂载后量一次即可，避免渲染期读 ref
  const [panelWidth, setPanelWidth] = useState(240);

  useEffect(() => {
    if (panelRef.current) setPanelWidth(panelRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    installProbe();
    const timer = setInterval(() => setTick((t) => t + 1), 300);
    const unsubscribe = subscribeWriteMode(setMode);
    const params = new URLSearchParams(window.location.search);
    if (params.has("stress")) {
      // 预置历史消息（?msgs= 可调）：每个 token 帧都会带动全部气泡重渲染，
      // 放大主线程压力，让"流式期间打字卡顿"可感知
      const msgCount = Math.min(
        parseInt(params.get("msgs") || "60", 10) || 60,
        300,
      );
      seedHistoryMessages(msgCount);
      // 压测轮数（?rounds= 可调）：1 轮 ≈ 1.8s，8 轮 ≈ 15s，足够边流式边打字
      const rounds = Math.min(
        parseInt(params.get("rounds") || "8", 10) || 8,
        20,
      );
      // 推流速率（?tps= 可调，token/s）：默认 40 便于阅读，压极限性能用 500
      const tps = Math.min(
        Math.max(parseInt(params.get("tps") || "40", 10) || 40, 5),
        500,
      );
      resetProbe();
      // chatBridge 带缓冲：ChatView 注册 handler 后自动重放
      const sender = setTimeout(
        () => chatBridge.sendMessage(`压测 x${rounds} tps${tps}`),
        300,
      );
      return () => {
        clearInterval(timer);
        clearTimeout(sender);
        unsubscribe();
      };
    }
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const s = getProbeStats();
  const now = performance.now();
  const elapsed = s.startedAt
    ? ((s.streaming ? now : s.endedAt || now) - s.startedAt) / 1000
    : 0;
  const rate =
    s.startedAt && elapsed > 0 ? (s.storeWrites / elapsed).toFixed(0) : "-";
  const amplify =
    s.listRenders > 0 ? (s.bubbleRenders / s.listRenders).toFixed(1) : "-";
  const fps =
    s.startedAt && elapsed > 0 ? (s.frames / elapsed).toFixed(0) : "-";
  const tpsParam = new URLSearchParams(window.location.search).get("tps");
  const status = s.streaming
    ? `流式中… ${elapsed.toFixed(1)}s`
    : s.startedAt
      ? `已结束 ${elapsed.toFixed(1)}s`
      : "待触发（?stress=1 自动压测）";

  // 每 300ms 轮询重渲染时顺便读取对话容器的位置，
  // 把面板贴到容器左侧外边；左侧空间不足时退回容器内左上角，避免飞出屏幕。
  const containerRect = document
    .querySelector("[data-chat-view]")
    ?.getBoundingClientRect();
  let left = 12;
  let top = 12;
  if (containerRect) {
    const outsideLeft = containerRect.left - panelWidth - 8;
    left = outsideLeft >= 0 ? outsideLeft : containerRect.left + 8;
    top = containerRect.top + 8;
  }

  return createPortal(
    <div ref={panelRef} style={{ ...panelBaseStyle, left, top }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <button
          type="button"
          style={modeBtnStyle(mode === "raw")}
          onClick={() => setWriteMode("raw")}
        >
          逐 token（基线）
        </button>
        <button
          type="button"
          style={modeBtnStyle(mode === "frame")}
          onClick={() => setWriteMode("frame")}
        >
          合帧（rAF）
        </button>
      </div>
      {`写入模式    ${mode === "frame" ? "合帧（rAF）" : "逐 token（基线）"}\n`}
      {`推流速率    ${tpsParam || 40} token/s（?tps= 可调）\n`}
      {`store 写入  ${s.storeWrites} 次 (${rate}/s)\n`}
      {`列表渲染    ${s.listRenders} 次\n`}
      {`气泡渲染    ${s.bubbleRenders} 次 (放大 ${amplify}x)\n`}
      {`实测 FPS    ${fps} (最差帧 ${Math.round(s.worstFrameGap)}ms)\n`}
      {`长任务      ${s.longTasks} 个 (最长 ${Math.round(s.maxTask)}ms)\n`}
      {status}
    </div>
    ,
    document.body,
  );
};

/** 预置 N 条历史消息（问答交替），模拟真实会话长度 */
const HISTORY_ANSWER = [
  "流式渲染的关键在于**数据到达的节奏**和**渲染提交的时机**解耦。\n",
  "- SSE 负责把 token 逐段推给前端\n",
  "- 状态库负责持有最新的完整文本\n",
  "- 渲染层应当按屏幕刷新率消费，而不是按 token 到达率消费\n\n",
  "```ts\n// 合帧的核心：一帧内多次写入只渲染一次\nconst schedule = (fn) => {\n  let id = 0;\n  return () => {\n    if (id) return;\n    id = requestAnimationFrame(() => { id = 0; fn(); });\n  };\n};\n```\n\n",
  "这样可以把渲染次数从 token 速率（几百次/秒）收敛到刷新率（60 次/秒）。",
].join("");

const seedHistoryMessages = (count: number) => {
  const msgs: CopilotMessage[] = [];
  for (let i = 0; i < count; i++) {
    const id = i + 1;
    if (i % 2 === 0) {
      msgs.push({
        _msgId: id,
        query: `历史问题 ${Math.floor(i / 2) + 1}：讲一下流式渲染的注意事项`,
      });
    } else {
      msgs.push({
        _msgId: id,
        text: HISTORY_ANSWER,
        finished: true,
        reqId: `req_seed_${id}`,
        sessionId: "session_seed",
      });
    }
  }
  useChatStore.setState({ messages: msgs, _nextMsgId: count + 1 });
};

export default StreamProbe;
