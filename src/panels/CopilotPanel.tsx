/**
 * CopilotPanel - 三模式面板容器
 *
 * 三种展示模式：
 * - Side: 固定侧边栏 position:fixed
 * - Float: 拖拽浮动窗口
 * - Push: 推挤主内容区 flex + 拖拽调宽
 *
 * Push 模式核心
 * - 6px 手柄 + document 级 mousemove
 * - 拖拽时禁用 transition,松手恢复 cubic-bezier
 * - will-change 提前提升合成层 + rAF 延迟入场
 */

import React, { useCallback, useEffect, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { useCopilotStore, PUSH_MIN_WIDTH } from "../store/copilot-store";
import { useDragFloat } from "../hooks/useDragFloat";
import ChatView from "../chat/ChatView";
import styles from "./panels.module.css";

const CopilotPanel: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const { open, mode, pushWidth, setMode, setPushWidth, closePanel } =
    useCopilotStore();
  const [pushEntered, setPushEntered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const {
    onMouseDown: onDragStart,
    position: floatPosition,
    ensureInitialized,
  } = useDragFloat();

  // Push 模式入场：用 rAF 确保 DOM 先 paint 再触发动画
  useEffect(() => {
    let rafId: number | undefined;
    if (open && mode === "push") {
      rafId = requestAnimationFrame(() => {
        setPushEntered(true);
      });
    } else {
      setPushEntered(false);
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [open, mode]);

  // Push 拖拽调宽
  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);

      const startX = e.clientX;
      const startWidth = pushWidth;

      const onMouseMove = (e: MouseEvent) => {
        const maxWidth = Math.floor(window.innerWidth * 0.8);
        const newWidth = Math.max(
          PUSH_MIN_WIDTH,
          Math.min(maxWidth, startWidth + startX - e.clientX),
        );
        setPushWidth(newWidth);
      };

      const onMouseUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [pushWidth, setPushWidth],
  );

  if (!open) return <>{children}</>;

  // 通用面板内容（Side + Push 共用）
  const panelContent = (
    <div className={styles.panelContent}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span>✨</span>
          <span>Copilot</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className={styles.modeSwitcher}>
            {(["push", "float", "side"] as const).map((m) => (
              <button
                key={m}
                className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "push" ? "推挤" : m === "float" ? "浮动" : "侧边"}
              </button>
            ))}
          </div>
          <CloseOutlined
            style={{ cursor: "pointer", fontSize: 14, color: "#999" }}
            onClick={closePanel}
          />
        </div>
      </div>
      <ChatView />
    </div>
  );

  // --- Side 模式 ---
  if (mode === "side") {
    return (
      <>
        {children}
        <div className={styles.sidePanel}>{panelContent}</div>
      </>
    );
  }
  // --- Float 模式 ---
  if (mode === "float") {
    ensureInitialized();
    return (
      <>
        {children}
        <div
          id="copilot-float-panel"
          className={styles.floatPanel}
          style={{ left: floatPosition.x, top: floatPosition.y }}
        >
          <div className={styles.floatHeader} onMouseDown={onDragStart}>
            <div className={styles.panelTitle}>
              <span>✨</span>
              <span>Copilot</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className={styles.modeSwitcher}>
                {(["push", "float", "side"] as const).map((m) => (
                  <button
                    key={m}
                    className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMode(m);
                    }}
                  >
                    {m === "push" ? "推挤" : m === "float" ? "浮动" : "侧边"}
                  </button>
                ))}
              </div>
              <CloseOutlined
                style={{ cursor: "pointer", fontSize: 14, color: "#999" }}
                onClick={closePanel}
              />
            </div>
          </div>
          <div className={styles.panelContent}>
            <ChatView />
          </div>
        </div>
      </>
    );
  }

  // --- Push 模式 ---
  return (
    <div className={styles.pushWrapper}>
      <div className={styles.pushMain}>{children}</div>
      <div
        className={`${styles.pushPanel} ${resizing ? styles.pushPanelResizing : ""} ${pushEntered ? styles.pushPanelEntered : ""}`}
        style={{ width: pushWidth, opacity: pushEntered ? 1 : 0 }}
      >
        <div
          className={`${styles.resizeHandle} ${resizing ? styles.resizeHandleActive : ""}`}
          onMouseDown={onResizeStart}
        />
        {panelContent}
      </div>
    </div>
  );
};

export default CopilotPanel;

//   ▎ 为什么 Float 模式有独立的 Header？
//   ▎ Float 模式的 Header 需要 onMouseDown={onDragStart} 来触发拖拽。Side/Push 模式的 Header 不需要拖拽。另外 Float 模式的 ChatView 在 panelContent div 内，不走外层的 panelContent
//   ▎ 变量，这样两个模式渲染互不干扰。
