/**
 * SSE 帧解析器 - 跨 chunk 缓冲的 SSE 协议解析
 * 核心难点： TCP 分片可能把一个 SSE 帧切成两半！
 * SSE 协议格式：
   data: {"content":"你"}\n\n
   data: {"content":"好"}\n\n
   data: [DONE]\n\n

   数据就是这样：两个换行符（空行）之间，表示一帧结束
   data: {"content":"你"}

   data: {"content":"好"}

   data: [DONE]
*  每次 reader.read() 可能：
   读完一个完整帧 -》直接解析
   拿到半帧 -》缓冲起来，等下一次 read() 补全
   拿到多个帧 -》 逐个解析
* buffer 用对象引用 { current: string } 而非纯字符串：
  如果传 'string' JS 中字符串是不可变的，函数内赋值  `buffer = 'xxx'`不会影响到调用方。而对象引用 `{ current }` 赋值 `buffer.current = 'xxx'` 会修改一个对象，跨多次调用保持状态。
  使得多次 reader.read() 调用能保持状态
 */
// 输入 -》缓冲 -〉切帧 -》提取 data -> 过滤
export const parseAgenthubSSEFrames = (
    chunkText: string,
    buffer: {current: string},
): string[] => {
    // 追加本次读到的文本
    buffer.current += chunkText;

    // 按 \r?\n\r?\n 切割出完整的"帧"
    const frames = buffer.current.split(/\r?\n\r?\n/);

    // 最后一段可能不完整(被 TCP 分片截断)，留到下次
    buffer.current = frames.pop() || '';

    return frames.flatMap((frame) => {
        // 每个帧内部，提取 data: 开头的行
        const data = frame
            .split(/\r?\n/) // 把当前帧的data数据分割出来
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.replace(/^data:\s?/, ''))
            .join('\n')
            .trim();
        // [DONE] 哨兵或空帧，忽略
        if(!data || data === 'DONE') return [];
        return [data];
    })
}