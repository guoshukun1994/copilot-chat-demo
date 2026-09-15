import React from 'react';
  import CopilotPanel from './panels/CopilotPanel';
  import { useCopilotStore } from './store/copilot-store';
  import { chatBridge } from './hooks/useChat';
  import { AgentId } from './core/types';
  import './App.css';

  const App: React.FC = () => {
    const { openPanel } = useCopilotStore();

    const handleOpenWithQuestion = (question: string, agentId?: AgentId) => {
      openPanel(question);
      chatBridge.sendMessage(question, agentId);
    };

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
              <p>点击下方按钮，Copilot 会自动打开并开始回答：</p >

              <div className="actionGrid">
                <button
                  className="actionCard"
                  onClick={() => handleOpenWithQuestion('你能帮我做什么？', AgentId.Normal)}
                >
                  <span className="actionIcon">💬</span>
                  <span className="actionLabel">通用问答</span>
                  <span className="actionDesc">平台功能介绍</span>
                </button>
                <button
                  className="actionCard"
                  onClick={() => handleOpenWithQuestion('请深度分析模型训练OOM的可能原因', AgentId.DeepThink)}
                >
                  <span className="actionIcon">🧠</span>
                  <span className="actionLabel">深度思考</span>
                  <span className="actionDesc">逐步推理分析</span>
                </button>
                <button
                  className="actionCard"
                  onClick={() => handleOpenWithQuestion('我的部署失败了，帮我诊断', AgentId.DeployCheck)}
                >
                  <span className="actionIcon">🔍</span>
                  <span className="actionLabel">部署诊断</span>
                  <span className="actionDesc">分析部署失败</span>
                </button>
                <button
                  className="actionCard"
                  onClick={() => handleOpenWithQuestion('API调用返回500，帮我排查', AgentId.CalledFailCheck)}
                >
                  <span className="actionIcon">🏥</span>
                  <span className="actionLabel">调用诊断</span>
                  <span className="actionDesc">排查调用失败</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </CopilotPanel>
    );
  };

  export default App;