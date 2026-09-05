/**
 * 核心类型定义 - Copilot 流式聊天的基础数据模型
 *
 * 设计要点：
 * - CopilotMessage 是流式渲染的“单例状态”，每个 SSE chunk 到达时更新它
 * - segments 支持一次 AI 响应中包含多段推理 + 回答(DeepThink 场景)
 * - think/rawText/text 三层文本
 * - think = 推理链，rawText = 含 think 标签的原始文本， text = 清洗后的可见文本
 */

/** Agent 类型（const 替代 enum,没有额外产物，指定值的类型，不会上升到string类型，兼容 erasableSyntaxOnly) */
export const AgentId = {
  Normal: "normal",
  DeepThink: "deep_think",
  DeployCheck: "deploy_check",
  CalledFailCheck: "called_fail_check",
} as const;
export type AgentId = (typeof AgentId)[keyof typeof AgentId];

/** 流事件类型 */
export const StreamEventType = {
  AssistantStart: "assistant_start",
  AsistantToolUse: "assistant_tool_use",
  SystemMessage: "system_message",
} as const;
export type StreamEventType =
  (typeof StreamEventType)[keyof typeof StreamEventType];

/** 单个流事件 */
export interface StreamEvent {
  id: string;
  type: StreamEventType;
  content?: string;
  data: Record<string, unknown>;
}

/** 消息段 - 一次 AI 响应可能包含多段推理 + 回答 */
export interface CopilotMessageSegment {
  id: string;
  /** 推理链 */
  think?: string;
  /** 原始文本，含 think 标签 */
  rawText: string;
  /** 清洗后的可见文本 */
  text: string;
  error?: string;
  events: StreamEvent[];
  finished?: boolean;
  interrupted?: boolean;
}

/** 一条完整的 Copilot 消息 */
export interface CopilotMessage {
  /** 内部唯一 ID（用于 React key, 由 store 生成） */
  _msgId?: number;
  query?: string;
  text?: string;
  rawText?: string;
  think?: string;
  hasResponseStarted?: boolean;
  isSandboxStarting?: boolean;
  error?: string;
  events?: StreamEvent[];
  segments?: CopilotMessageSegment[];
  finished?: boolean;
  interrupted?: boolean;
  agentId?: string;
  sessionId?: string;
  msgId?: string;
  reqId?: string;
  traceId?: string;
  streamStartedAt?: number;
  streamEndedAt?: number;
}

/** 用户输入参数 */
export interface CopilotInput {
  query: string;
  userId: string;
  agentId?: AgentId | string;
}

/** SSE 输出帧 */
export interface SSEOutput {
  data?: string;
  event?: string;
  id?: string;
  retry?: unknown;
}

/** Agenthub 事件格式（新协议） */
export interface AgentHubEvent {
  sid?: string;
  uuid?: string;
  turn?: number;
  role?: string;
  type: "stream" | "template" | "TOOL";
  text?: string;
  content?: {
    type?: string;
    body?: {
      tool_call_id?: string;
      tool_name?: string;
      args?: Record<string, unknown>;
      output?: string;
      error?: string | null;
    };
  };
  finished?: boolean;
  finishReason?: string;
}

/** 内嵌工具调用事件 */
export interface AgenthubInlineToolEvent {
  type: "TOOL";
  running?: boolean;
  success?: boolean;
  code?: string;
  message?: string;
  tool?: string;
  executeId?: string;
  name?: string;
  inputs?: string | Record<string, unknown>;
  outputs?: string | Record<string, unknown>;
}

/** StreamChat 信封格式 */
export interface StreamChatEnvelope {
  success?: boolean;
  errorCode?: string;
  errorMsg?: string;
  data?: {
    msgId?: string;
    sessionId?: string;
    chatId?: string;
    traceId?: string;
    reqId?: string;
    agentId?: string;
    msgType?: "CHAT_INIT" | "CHAT" | "CHAT_CoT" | "CHAT_EXIT";
    replyCmd?: string;
    finished?: boolean;
    finishReason?: string;
    exitReason?: string;
    contents?: Array<{
      unitId?: string;
      indexId?: number;
      contentType?: string;
      content?: {
        text?: string;
        type?: string;
        replyCmd?: string;
        finished?: boolean;
        event?: AgenthubInlineToolEvent;
      };
      related?: unknown;
    }>;
  };
}

/** 面板展示模式 */
export type PanelMode = "side" | "float" | "push";
