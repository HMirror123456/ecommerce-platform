# 电商平台小组项目

复刻类似京东的多端电商系统（用户网页端、商家后台、平台管理后台等），3 人小组、约 3 周开发周期。

## 项目目标

- **重点**：业务逻辑理解深度、完整用户体验流程、操作便捷、界面布局合理
- **交付**：可运行的核心链路 Demo + 一篇业务理解报告（见 `docs/REPORT_TEMPLATE.md`）

## 目录结构

```
ecommerce-platform/
├── docs/                   # 设计文档（开发前必读，开发后写报告）
│   ├── research/           # 各业务域调研
│   ├── domain/             # 领域模型、状态机
│   ├── prd/                # 产品需求
│   ├── api/                # OpenAPI 接口契约
│   └── ui/                 # UI 规范与线框说明
├── packages/               # 各端代码（按分工创建）
│   ├── web-user/           # 用户端（网页/小程序）
│   ├── web-merchant/       # 商家后台
│   ├── web-admin/          # 平台管理后台
│   └── shared/             # 共用类型、工具
└── .cursor/rules/          # Cursor AI 协作规则（全员共用）
```

## 快速开始

1. Clone 仓库：`git clone <repo-url>`
2. 阅读文档顺序：
   - `docs/BUSINESS_GLOSSARY.md` — 业务术语
   - `docs/domain/DOMAIN_MODEL.md` — 领域模型
   - `docs/GIT_WORKFLOW.md` — Git 协作规范
   - `docs/CURSOR_SETUP.md` — AI 协作配置
3. 按 `docs/TIMELINE_3WEEKS.md` 推进

## 分工参考

| 角色 | 负责域 | 主要端 |
|------|--------|--------|
| 组长 | 平台域 + 交易域 | 管理后台、Git/联调 |
| 成员 A | 用户域 | 用户网页端 |
| 成员 B | 商品域 + 商家域 | 商家后台 |

## 技术栈（待组内确认后更新）

- 后端：<!-- 如 Spring Boot / Node.js + Express -->
- 前端：<!-- 如 Vue3 + Element Plus / React + Ant Design -->
- 数据库：<!-- 如 MySQL / PostgreSQL -->

## 文档索引

| 文档 | 说明 |
|------|------|
| [业务术语表](docs/BUSINESS_GLOSSARY.md) | 统一业务语言 |
| [领域模型](docs/domain/DOMAIN_MODEL.md) | 实体、关系、状态机 |
| [产品需求](docs/prd/PRD.md) | 功能列表与优先级 |
| [API 契约](docs/api/openapi.yaml) | 前后端接口定义 |
| [UI 规范](docs/ui/UI_GUIDE.md) | 配色、布局、组件 |
| [Git 协作](docs/GIT_WORKFLOW.md) | 分支与提交规范 |
| [3 周时间线](docs/TIMELINE_3WEEKS.md) | 里程碑与任务 |
| [报告模板](docs/REPORT_TEMPLATE.md) | 开发完成后撰写 |
