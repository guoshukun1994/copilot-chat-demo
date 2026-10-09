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
  const lastScrollTopRef = useRef(0);

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

    // 用户意图必须同步捕获：scroll 事件是异步、按帧合并的，流式高频
    // commit 会抢先把 scrollTop 拽回底部，等 scroll 事件到达时位置已经
    // 在底部，“上滚暂停”永远抢不过。wheel/touchmove 在手势当下同步触发，
    // 能在下一次 commit 前记下意图。
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        // 向上滚：立即暂停自动滚动，不等 scroll 事件
        isUserScrollingRef.current = true;
      }
    };

    const handleTouchMove = () => {
      // 触摸滚动拿不到方向，按当前位置判断；手势期间事件持续同步触发
      isUserScrollingRef.current = !isNearBottom();
    };

    const handleScroll = () => {
      // 兜底：方向 + 回底判断（覆盖拖动滚动条、键盘翻页等无 wheel 的场景）。
      // scrollTop 变小的滚动只会来自用户（程序只滚到底），立即暂停；
      // 回到接近底部时才恢复自动滚动。
      const st = el.scrollTop;
      if (st < lastScrollTopRef.current - 1) {
        isUserScrollingRef.current = true;
      } else if (isNearBottom()) {
        isUserScrollingRef.current = false;
      }
      lastScrollTopRef.current = st;
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("scroll", handleScroll);
    };
  }, [isNearBottom]);

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom("instant");
    }
  }, [dependency, scrollToBottom]);

  return containerRef;
};
