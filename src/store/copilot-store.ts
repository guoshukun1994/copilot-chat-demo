/**
 * Copilot 全局状态 - 面板开关、模式、Agent选择
 */

import { create } from "zustand";
import { AgentId, type PanelMode } from "../core/types";

interface CopilotState {
  open: boolean;
  mode: PanelMode;
  pushWidth: number;
  agentId: AgentId;
  initialQuesion: string;
}

interface CopilotActions {
  openPanel: (questing?: string, mode?: PanelMode) => void;
  closePanel: () => void;
  setMode: (mode: PanelMode) => void;
  setPushWidth: (width: number) => void;
  setAgentId: (id: AgentId) => void;
}

const PUSH_MIN_WIDTH = 420;
const PUSH_DEFAULT_WIDTH = 540;

export const useCopilotStore = create<CopilotState & CopilotActions>((set) => ({
  open: false,
  mode: "push",
  pushWidth: PUSH_DEFAULT_WIDTH,
  agentId: AgentId.Normal,
  initialQuesion: "",

  openPanel: (question, mode) =>
    set({
      open: true,
      initialQuesion: question || "",
      ...(mode ? { mode } : {}),
    }),

  closePanel: () => set({ open: false, initialQuesion: "" }),

  setMode: (mode) => set({ mode }),

  setPushWidth: (width) => set({ pushWidth: width }),

  setAgentId: (id) => set({ agentId: id }),
}));

export { PUSH_DEFAULT_WIDTH, PUSH_MIN_WIDTH };
