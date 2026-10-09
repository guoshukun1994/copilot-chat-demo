/**
 * 合帧写入器
 *
 * 高频更新先缓存快照，到下一帧渲染前只写出最新一次：
 * 一帧内推入 N 次，也只产生 1 次写入（N 合 1）。
 * 这样可以把写入/渲染频率从 token 到达率（几百次/秒）
 * 收敛到屏幕刷新率（约 60 次/秒）。
 */
export const createFrameBatcher = <T>(write: (value: T) => void) => {
  let rafId = 0;
  let pending: T | null = null;

  const flush = () => {
    rafId = 0;
    if (pending === null) return;
    const value = pending;
    pending = null;
    write(value);
  };

  return {
    /** 推入最新快照；同一帧内的后续推入会覆盖前一个，不重复排队 */
    push(value: T) {
      pending = value;
      if (!rafId) rafId = requestAnimationFrame(flush);
    },
    /** 立即写出缓存（流正常结束时调用，保证 finished 等最终状态落库） */
    flushNow() {
      if (rafId) cancelAnimationFrame(rafId);
      flush();
    },
    /** 丢弃缓存（出错时调用，避免旧快照覆盖错误提示） */
    drop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
    },
  };
};
