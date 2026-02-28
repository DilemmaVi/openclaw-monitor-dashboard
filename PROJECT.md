# OpenClaw 监控面板（本机）

## 目标（V1）
- 仅本机使用（默认 `localhost`），无需复杂鉴权
- 监控三类核心信号：
  1) **成本**：优先接入 CodeZ 指标（今日消费/调用次数/缓存命中率/今日剩余额度/历史总消耗）
  2) **Cron 交付**：每天简报与 Trending 任务的运行结果、是否成功发送到飞书、产物文件是否有效（非空 docx）
  3) **主机资源**：CPU/内存/磁盘、关键进程（openclaw gateway）健康度

## 技术栈（建议）
- 后端：Node.js + TypeScript，提供本地 HTTP API（Express 或 Fastify）
- 前端：Vite + React + TypeScript（轻量、迭代快）
- 数据刷新：轮询（2-5s），后续可升级 SSE

## 约束
- 项目位于：`workspace/projects/active/openclaw-monitor-dashboard/`
- 浏览器相关自动化若需要：优先 `agent-browser`（CLI）；只有搞不定才用 OpenClaw `browser` 工具

## 运行方式（预计）
- `pnpm i`
- `pnpm dev` 启动前后端（或分别启动）

## 数据源设想
- OpenClaw：`openclaw status` / `openclaw gateway status` / workspace 日志文件
- Cron：cron 输出落盘（需要我们统一约定一个 `monitor/` 目录写 run result JSON）
- 成本：调用现有 `scripts/codez_fetch_metrics_api.py`（通过环境变量/本地 cookie）并由后端封装
- 资源：Node 读取 `os` 指标，或调用 `ps`/`df`/`vm_stat` 等（Darwin）
