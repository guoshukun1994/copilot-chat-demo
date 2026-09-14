/**
 * Agent 路由 - 级联路由逻辑 + 配置
 */

import { AgentId } from "../core/types";
import type { CopilotInput } from "../core/types";

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  icon: string;
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: AgentId.Normal,
    name: "通用问答",
    description: "平台使用引导、概念解释",
    icon: "💬",
  },
  {
    id: AgentId.DeepThink,
    name: "深度思考",
    description: "复杂问题逐步推理",
    icon: "🧠",
  },
  {
    id: AgentId.DeployCheck,
    name: "部署诊断",
    description: "自动分析部署失败原因",
    icon: "🔍",
  },
  {
    id: AgentId.CalledFailCheck,
    name: "调用诊断",
    description: "诊断API调用失败原因",
    icon: "🏥",
  },
];

export const resolveAgentId = (options: {
  isDeployCheck?: boolean;
  isOpenCalledFailCheck?: boolean;
  isDeepThink?: boolean;
}): AgentId => {
  const { isDeployCheck, isOpenCalledFailCheck, isDeepThink } = options;
  return isDeployCheck
    ? AgentId.DeployCheck
    : isOpenCalledFailCheck
      ? AgentId.CalledFailCheck
      : isDeepThink
        ? AgentId.DeepThink
        : AgentId.Normal;
};

export const buildChatInput = (
  query: string,
  agentId: AgentId,
  userId = "demo_user",
): CopilotInput => ({ query, userId, agentId });
