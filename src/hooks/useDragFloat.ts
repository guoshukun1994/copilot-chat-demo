/**
 * useDragFloat - 浮动面板拖拽
 *
 * - 原生 mousedown/mousemove/mouseup
 * - 16px 视口边距钳位
 * - 位置持久化到 state（避免 re-render 覆盖 拖拽位置）
 */

import { useCallback, useRef, useState } from "react";

const MARGIN = 16;

export const useDragFloat = () => {
  const [position, setPosiiton] = useState({ x: 0, y: 52 });
  const positionRef = useRef(position);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  const ensureInitialized = useCallback(() => {
    if (!initializedRef.current) {
      const x = window.innerWidth - 560;
      positionRef.current = { x, y: 52 };
      setPosiiton({ x, y: 52 });
      initializedRef.current = true;
    }
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      ensureInitialized();
      draggingRef.current = true;
      offsetRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y,
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current) return;
        const x = Math.max(
          MARGIN,
          Math.min(window.innerWidth - MARGIN, e.clientX - offsetRef.current.x),
        );
        const y = Math.max(
          MARGIN,
          Math.min(
            window.innerHeight - MARGIN,
            e.clientY - offsetRef.current.y,
          ),
        );
        positionRef.current = { x, y };
        setPosiiton({ x, y });
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [ensureInitialized],
  );

  return { onMouseDown, position, ensureInitialized };
};
