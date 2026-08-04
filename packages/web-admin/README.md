# 平台管理后台

组长负责。业务详见 [`docs/domain/ADMIN.md`](../../docs/domain/ADMIN.md)。

## 技术栈

- Vue 3 + Vite 2 + Element Plus + Pinia + Vue Router

## 启动（需先启动 API）

```bash
# 终端 1
cd packages/api && npm run dev

# 终端 2
cd packages/web-admin && npm install && npm run dev
```

- 前端：http://localhost:5174
- API 代理：`/api` → `http://localhost:8080`

## 演示登录

- 账号：`operator`
- 密码：`operator123`

## 页面

| 路由 | 功能 |
|------|------|
| `/login` | 管理员登录 |
| `/audit/products` | 商品审核（列表 / 详情 / 通过 / 驳回） |

## Cursor 开发

```
@docs/domain/ADMIN.md
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
@docs/ui/UI_GUIDE.md
```

## Node 版本

- **最低要求：Node 14.17+**（当前环境 v14.17.5 可运行）
- **推荐：Node 18 LTS 或 20 LTS**（Vite 5+、热重载更稳定）
- API 的 `npm run dev` 在 Node 14 下为普通启动；Node 18+ 可改用 `node --watch`
