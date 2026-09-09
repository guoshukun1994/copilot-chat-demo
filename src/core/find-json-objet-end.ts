/**
 * 嵌套 JOSN 边界检测 - 逐字符状态机
 * 为什么不用正则
    正则无法正确匹配嵌套 JSON（JSON 可以嵌套{ {} })
    字符串内部的 { } 不算嵌套层级
    遇到转义引导 " 要正确跳过
 * 状态及维护三个变量
    depth: 大括号嵌套深度，depth 回到 0 意味着找到完整 JSON
    inString: 是否在双引号字符串内部
    escaped: 上一个字符是否是转义字符
 */
export const findJsonObjectEnd = (text: string, startIndex: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) break;
    if (inString) {
      // 只有在字符串内部才去判断是不是转义，是转义就不用结束当前字符串
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        /**
         * 在 JS/TS 里：
            \n 表示换行
            \t 表示制表符
            \" 表示引号
            \\ 表示一个反斜杠
         */
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue; // 字符串内部的字符不影响 depth
    }

    // 不在字符串内部
    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index; // 找到完整 JSON 的结束位置！
      }
    }
  }
  return -1; // 不完整，还需要更多数据
};
