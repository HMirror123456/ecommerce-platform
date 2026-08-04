# Git 协作规范

> 3 人小组必守。有问题在群里 @组长。

## 1. 分支策略

```
main          ← 稳定可演示，仅通过 PR 合并
  └── develop ← 日常集成，默认基于此开分支
        ├── feature/user-login
        ├── feature/merchant-product
        └── feature/admin-audit
```

| 分支类型 | 命名 | 说明 |
|----------|------|------|
| 主分支 | `main` | 保护分支，禁止 force push |
| 开发分支 | `develop` | 功能集成 |
| 功能 | `feature/<模块>-<简述>` | 如 `feature/order-checkout` |
| 修复 | `fix/<简述>` | |
| 文档 | `docs/<简述>` | |

---

## 2. 日常流程

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
# 开发 & commit
git push -u origin feature/your-feature
# 提 PR，至少 1 人 Review
```

---

## 3. Commit 规范

格式：`<type>(<scope>): <subject>`

**scope 示例**：`user`, `merchant`, `admin`, `order`, `product`, `api`, `domain`

---

## 4. 目录归属

| 目录/模块 | 主负责人 | 其他人 |
|-----------|----------|--------|
| `packages/web-user/` | 成员 A | 只改自己的 PR |
| `packages/web-merchant/` | 成员 B | |
| `packages/web-admin/` | 组长 | |
| `docs/domain/ADMIN.md` | 组长 | |
| `docs/domain/DOMAIN_MODEL.md` | 组长主笔 | 全员 Review |
| `docs/api/openapi.yaml` | 改前先群里说 | 按 tag 分模块 |

**openapi 分工：**

| tag | 负责人 |
|-----|--------|
| user, cart | 成员 A |
| product, merchant | 成员 B |
| order, admin, auth | 组长 |

---

## 5. Issue 标签

`P0` / `P1` / `P2` + `user` / `merchant` / `admin` / `docs`
