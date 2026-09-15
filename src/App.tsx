import React from "react";
import CopilotPanel from "./panels/CopilotPanel";
import { useCopilotStore } from "./store/copilot-store";
import "./App.css";

const App: React.FC = () => {
  const { openPanel } = useCopilotStore();

  return (
    <CopilotPanel>
      <div className="mainContent">
        <div className="mainHeader">
          <h1 className="mainTitle">AIStudio Demo</h1>
          <button className="copilotTrigger" onClick={() => openPanel()}>
            ✨ 打开 Copilot
          </button>
        </div>

        <div className="mainBody">
          <div className="placeholderCard">
            <h2>🧪 Copilot Chat Demo</h2>
            <p>
              这是一个独立可运行的教学 Demo，展示了 AIStudio Copilot
              前端的核心技术实现。
            </p>
            <ul>
              <li>
                <strong>SSE 流式渲染</strong> — 打字机效果 + Think 标签清洗 +
                嵌套 JSON 提取
              </li>
              <li>
                <strong>三模式面板</strong> — Side / Float / Push + 拖拽调宽
              </li>
              <li>
                <strong>Multi-Agent 路由</strong> — 通用问答 / 深度思考 /
                部署诊断 / 调用诊断
              </li>
              <li>
                <strong>流健壮性</strong> — 空闲超时守卫 + 白噪声过滤 + 中断降级
              </li>
            </ul>
            <p style={{ color: "#999", fontSize: 14 }}>
              点击右上角「✨ 打开 Copilot」按钮开始体验 →
            </p>
          </div>
        </div>
      </div>
    </CopilotPanel>
  );
};

export default App;
