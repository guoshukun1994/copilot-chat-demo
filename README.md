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
4.1 src/core/parse-sse-frames.ts - 帧解析器
4.2 src/core/strip-think.ts - Think 标签实时清洗
4.3 src/core/find-json-object-end.ts 嵌套 JSON 边界检测
4.4 src/core/extract-inline-tool-events.ts 从流式文本中提取嵌入的工具调用 JSON
4.5 scr/core/stream-idle-timeout.ts 流空闲超时守卫

