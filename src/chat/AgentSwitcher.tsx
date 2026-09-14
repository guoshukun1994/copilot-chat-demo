import React from "react";
import { AgentId } from "../core/types";
import { AGENT_CONFIGS } from "../agent/agent-router";
import styles from "./chat.module.css";

interface AgentSwitcherProps {
  currentAgentId: AgentId;
  onAgentChange: (id: AgentId) => void;
}

const AgentSwitcher: React.FC<AgentSwitcherProps> = ({
  currentAgentId,
  onAgentChange,
}) => (
  <div className={styles.agentSwitcher}>
    {AGENT_CONFIGS.map((config) => (
      <button
        key={config.id}
        className={`${styles.agentTab} ${currentAgentId === config.id ? styles.agentTabActive : ""}`}
        onClick={() => onAgentChange(config.id)}
        title={config.description}
      >
        <span>{config.icon}</span>
        <span>{config.name}</span>
      </button>
    ))}
  </div>
);

export default AgentSwitcher;
