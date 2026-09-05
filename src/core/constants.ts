/** 需要隐藏的 contentType, O(1)查找 */
export const HIDEN_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "thinking",
  "thought",
  "tool_call",
]);

/** 判断 contentType 是否可见 */
export const isVisibleContentType = (contentType?: string): boolean =>
  !contentType || HIDEN_CONTENT_TYPES.has(contentType);

// 提取常量？HIDEN_CONTENT_TYPES 在 stream-adapter 和 transform-message 两处都要用，统一到 constants.ts 消除重复
