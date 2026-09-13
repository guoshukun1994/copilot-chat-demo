/**
 * useAutoScroll - 智能自动滚动
 *
 * 优化点：
 * 1. 用户上滚查看历史时，暂停自动滚动
 * 2. 新消息到来时用 instant 滚动(避免 smooth 动画堆积)
 * 3. 用户滚回底部时恢复自动滚动
 */

import { useCallback, useEffect, useRef } from "react";

const BOTTOM_THERSHOLD = 80;

export const useAutoScroll = (dependency: unknown) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THERSHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      isUserScrollingRef.current = !isNearBottom;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom("instant");
    }
  }, [dependency, scrollToBottom]);

  return containerRef;
};
