# Repository Guidelines

## Project Structure & Module Organization

Copilot Chat Demo is a React 19 + TypeScript + Vite frontend backed by a mock Express SSE server.

- `src/chat/` - chat UI components (`ChatView.tsx`, `ChatInput.tsx`) with `*.module.css` colocated per feature
- `src/messages/` - message rendering (Markdown, tool calls, deep-think blocks)
- `src/core/` - framework-free logic: SSE parsing, stream adapters, types
- `src/agent/` - client-side agent routing (`agent-router.ts`)
- `src/store/` - zustand stores (`chat-store.ts`, `copilot-store.ts`)
- `src/hooks/` - React hooks (`useChat.ts`, `useAutoScroll.ts`, `useDragFloat.ts`)
- `src/panels/`, `src/assets/`, `public/` - panel UI, imported assets, static files
- `server/` - mock SSE backend; `server/agents/` holds one generator per agent type
- `dist/` - build output (generated, do not edit)

## Build, Test, and Development Commands

- `npm run dev:all` - run mock server (port 3001) and Vite dev server together; use this for local development
- `npm run dev` / `npm run dev:server` - run frontend or backend alone
- `npm run build` - production build to `dist/`
- `npm run typecheck` - `tsc --noEmit` against `tsconfig.app.json` and `tsconfig.node.json`
- `npm run lint` - oxlint (config in `.oxlintrc.json`, react/typescript/oxc plugins)
- `npm run check` - typecheck + lint; must pass before submitting
- `npm run preview` - serve the production build

The dev server proxies `/api/*` to `http://localhost:3001`; override with `VITE_API_TARGET`.

## Coding Style & Naming Conventions

- TypeScript strict mode, ESM modules, 2-space indentation, double quotes
- Components: `PascalCase.tsx`; hooks: `useCamelCase.ts`; utilities: `kebab-case.ts`
- Styles via CSS Modules named after the feature folder, e.g. `chat.module.css`
- Keep `src/core/` free of React imports; UI depends on core, never the reverse
- UI uses Ant Design components and `@ant-design/icons`; state via zustand stores

## Testing Guidelines

No test runner is configured yet. `npm run check` (typecheck + lint) is the required quality gate. When adding tests, colocate them as `*.test.ts(x)` next to the source, prioritize `src/core/` stream/parsing logic, and verify SSE flows manually against the mock server (`npm run dev:all`).

## Commit & Pull Request Guidelines

History follows Conventional Commits: `type(scope): subject` (subjects are written in Chinese). Types in use: `feat`, `fix`, `docs`, `refactor`; scopes mirror module folders (`chat`, `messages`, `hooks`, `panels`, `agent`, `readme`). Example: `feat(panels): 三模式面板功能添加`.

PRs should include a short description of the change, linked issues, `npm run check` output passing, and a screenshot or recording for UI changes.
