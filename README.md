# 电商平台小组项目

复刻类似京东的多端电商系统（用户网页端、商家后台、平台管理后台等），3 人小组、约 3 周开发周期。

**仓库地址：** https://github.com/HMirror123456/ecommerce-platform

## 项目目标

- **重点**：业务逻辑理解深度、完整用户体验流程、操作便捷、界面布局合理
- **交付**：可运行的核心链路 Demo + 一篇业务理解报告（见 `docs/REPORT_TEMPLATE.md`）

## 目录结构

```
ecommerce-platform/
├── docs/
│   ├── domain/             # 领域模型 + 管理后台文档
│   ├── api/                # OpenAPI 接口契约
│   └── ui/                 # UI 规范
├── packages/
│   ├── web-user/           # 用户端 — 成员 A
│   ├── web-merchant/       # 商家后台 — 成员 B
│   ├── web-admin/          # 平台管理后台 — 组长
│   └── shared/             # 共用类型、工具
└── .cursor/rules/          # Cursor AI 协作规则（全员共用）
```

## 快速开始

1. Clone 仓库：`git clone https://github.com/HMirror123456/ecommerce-platform.git`
2. 阅读文档（按顺序）：
   - `docs/BUSINESS_GLOSSARY.md` — 业务术语
   - `docs/domain/DOMAIN_MODEL.md` — 实体、状态机、业务决策
   - `docs/GIT_WORKFLOW.md` — Git 协作规范
3. **组长** 额外阅读：`docs/domain/ADMIN.md`
4. 开发前确认 `docs/api/openapi.yaml` 接口契约

## 分工

| 角色 | 负责域 | 主要端 |
|------|--------|--------|
| 组长 | 平台域 + 交易域 | 管理后台、订单/支付 API、联调 |
| 成员 A | 用户域 | 用户网页端 |
| 成员 B | 商品域 + 商家域 | 商家后台 |

## Cursor 开发 @ 引用

| 角色 | 固定 @ 引用 |
|------|-------------|
| 组长（Admin） | `ADMIN.md` + `DOMAIN_MODEL.md` + `openapi.yaml` + `UI_GUIDE.md` |
| 成员 A | `DOMAIN_MODEL.md` + `openapi.yaml`（user/cart/order tag）+ `UI_GUIDE.md` |
| 成员 B | `DOMAIN_MODEL.md` + `openapi.yaml`（product/merchant tag）+ `UI_GUIDE.md` |

`.cursor/rules/project.mdc` 自动生效，无需每次 @。

**原则：** 改接口先改 `openapi.yaml`，改状态先改 `DOMAIN_MODEL.md`。

## 技术栈（组内确认后更新）

- 后端：<!-- 如 Spring Boot 3 + MyBatis-Plus -->
- 前端：<!-- 如 Vue 3 + Element Plus -->
- 数据库：<!-- 如 MySQL 8 -->

## 文档索引

| 文档 | 说明 |
|------|------|
| [业务术语表](docs/BUSINESS_GLOSSARY.md) | 统一业务语言 |
| [领域模型](docs/domain/DOMAIN_MODEL.md) | 实体、关系、状态机、业务决策 |
| [管理后台](docs/domain/ADMIN.md) | 组长：功能、权限、路由、交接顺序 |
| [API 契约](docs/api/openapi.yaml) | 前后端接口定义（唯一真相源） |
| [UI 规范](docs/ui/UI_GUIDE.md) | 配色、布局、组件 |
| [Git 协作](docs/GIT_WORKFLOW.md) | 分支与提交规范 |
| [产品需求](docs/prd/PRD.md) | A/B 端功能清单（Admin 见 ADMIN.md） |
| [报告模板](docs/REPORT_TEMPLATE.md) | W3 开发完成后撰写 |
