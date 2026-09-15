# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## 项目 从 0--》1 全流程

### 1、项目脚手架

1.1 创建项目
npm create vite@latest copilot-chat-demo -- --template react-ts

1.2 安装依赖
`运行时依赖`
npm i zustand @ant-design/icons antd copy-to-clipboard
`开发依赖`
npm i -D express cors concurrently tsx
npm i -D @types/express @types/cors

1.3 配置 tsconfig (.app/.node)

1.4 配置 vite 代理 避免跨域

1.5 配置 package.json scripts

1.6 修正 index.html

1.7 创建目录结构
mkdir -p src/core src/hooks src/store src/chat src/message src/panels src/agent src/assets
mkdir -p server/agents

1.8 补全 .gitignore

### 2、核心类型定义 - (src/core/types.ts、constants.ts)

### 3、Mock SSE 服务器 - 生产流式数据

server/sse-helpers.ts
server/agents/xxx.ts
server/index.ts

curl 介绍：

    curl
    表示发一个 HTTP 请求

    -X POST
    指定请求方法为 POST
    也就是“提交数据”而不是 GET

    -H "Content-Type: application/json"
    设置请求头
    告诉服务端：我发的是 JSON 数据

    -d '{"query":"你好","agentId":"normal"}'
    -d 表示发送请求体（data）
    这里把 JSON 数据放进请求体里

    -N
    表示 “不要在输出里缓冲，实时显示流式内容”
    这对 SSE / 流式响应特别重要
    也就是说：服务端如果是持续输出内容，-N 可以让你一行一行实时看到

    普通get请求直接 curl url;
    普通post curl -X POST url \
    -H "Content-Type: application/json" \
    -d '{xx}'

### 4、SSE 帧解析器 + 流式文本清洗

SSE 数据从网络来到前端，要经过三道关卡：帧解析 -》 think 标签清洗 -〉内嵌 JSON 工具提取

- 4.1 src/core/parse-sse-frames.ts - 帧解析器
- 4.2 src/core/strip-think.ts - Think 标签实时清洗
- 4.3 src/core/find-json-object-end.ts 嵌套 JSON 边界检测
- 4.4 src/core/extract-inline-tool-events.ts 从流式文本中提取嵌入的工具调用 JSON
- 4.5 scr/core/stream-idle-timeout.ts 流空闲超时守卫

### 5、消息状态机（transform-message）-最核心、最复杂

- 每次 SSE chunk 到达时，将旧的 CopilotMessage + 新的 chunk -> 新的 CopilotMessage.

* 5.1 src/core/transform-message.ts

### 6、ChatProvider + Zustand Store

- 6.1 src/core/chat-provider.ts - 串联所有 core 模块
  - 数据流回顾： fetch -> reader.read() -> parseSSEFrames -> transformMessage -> onUpdate -> Store -> React
- 6.2 src/store/chat-store.ts - 对话状态管理 - 消息列表、会话、请求控制
- 6.3 src/store/copilot-store.ts - Copilot 全局状态 - 面板开关、模式、Agent 选择

**_到此，数据引擎全部完成_**
`用户输入 -> fetch POST -> SSE 帧流 -> parseSSEFrames -> transformMessage -> Store -> ? ` 下一步接 React UI

### 7、连接 数据引擎 和 React UI（useChat Hook + ChatBridge）

- 7.1 src/hooks/useChat.ts - 对话管理 Hook
- 7.2 src/hooks/useAutoScroll.ts - 智能自动滚动
- 7.3 src/hooks/useDragFloat.ts - 浮动画板拖拽

### 8、基础 UI - (马上能在浏览器聊天了)

- 8.1 src/agent/agent-router.ts - Agent 路由
- 8.2 src/messages/MarkdownContent.tsx - 安全的 Markdown 渲染
- 8.3 src/messages/DeepThinkBlock.tsx - DeepThink + ToolCall + MessageActions
- 8.4 src/messages/messageBubble.tsx - MessageBubble
- 8.5 src/chat/ChatInput.tsx - ChatInput
- 8.6 src/chat/AgentSwitcher.tsx - AgentSwitcher + Welcome
- 8.7 src/chat/ChatView - ChatView(主视图)
- 8.8 src/chat/xxx.module.css - chat下的css
- 8.9 src/App.tsx - 串联到 App

### 9、三模式面板（Side / Float / Push）

- 9.1 src/panels/panels.module.css - 面板样式
- 9.2 src/panels/CopilotPanel.tsx
- 9.3 src/App.tsx - 更新主布局
- 9.4 src/App.css - 更新全局样式

### 10 ChatBridge 打通主页面 -》 面板

**_ 目前打开面板不会自动发消息，需要把 openPanel(question) 和Chat面板串联起来 _**

- 10.1 修改 App.tsx - 增强主页面交互
