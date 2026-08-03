# Git 协作规范

> 3 人小组必守，避免互相覆盖。有问题在群里 @组长。

## 1. 分支策略

```
main          ← 稳定可演示，仅通过 PR 合并
  └── develop ← 日常集成，默认基于此开分支
        ├── feature/user-login
        ├── feature/merchant-product
        └── docs/domain-model
```

| 分支类型 | 命名 | 说明 |
|----------|------|------|
| 主分支 | `main` | 保护分支，禁止 force push |
| 开发分支 | `develop` | 功能集成 |
| 功能 | `feature/<模块>-<简述>` | 如 `feature/order-checkout` |
| 修复 | `fix/<简述>` | 如 `fix/cart-quantity` |
| 文档 | `docs/<简述>` | 如 `docs/research-product` |

---

## 2. 日常流程

```bash
# 1. 开始新任务前
git checkout develop
git pull origin develop

# 2. 创建功能分支
git checkout -b feature/your-feature

# 3. 开发 & 提交（见 commit 规范）
git add .
git commit -m "feat(cart): add quantity update API"

# 4. 推送并提 PR（或让组长 Review 后合并）
git push -u origin feature/your-feature
```

---

## 3. Commit 规范

格式：`<type>(<scope>): <subject>`

| type | 用途 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 仅文档 |
| style | 格式（不影响逻辑） |
| refactor | 重构 |
| test | 测试 |
| chore | 构建/工具 |

**scope 示例**：`user`, `merchant`, `admin`, `order`, `product`, `api`, `domain`

**示例：**
```
feat(order): implement order creation with stock lock
docs(domain): add after-sale state machine
fix(cart): prevent negative quantity
```

---

## 4. Pull Request 规则

1. **每个 PR 聚焦一件事**（一个功能或一份文档）
2. **描述模板**：
   ```markdown
   ## 做了什么
   -
   ## 如何验证
   -
   ## 关联 Issue / 文档
   -
   ```
3. **至少 1 人 Review** 后才能合并到 `develop`
4. 合并到 `main` 前：三人确认 Demo 可跑

---

## 5. 冲突处理

- 优先在本地 `develop` 拉最新，再 `git merge develop` 到功能分支
- 不懂的冲突标记 `@组长`，不要强行全选一边
- **禁止** 在共享分支上 `git push --force`

---

## 6. 目录归属（减少改同一文件）

| 目录/模块 | 主负责人 | 其他人 |
|-----------|----------|--------|
| `packages/web-user/` | 成员 A | 只改自己的 PR |
| `packages/web-merchant/` | 成员 B | |
| `packages/web-admin/` | 组长 | |
| `docs/research/user/` | 成员 A | |
| `docs/research/product-merchant/` | 成员 B | |
| `docs/research/platform-trade/` | 组长 | |
| `docs/api/openapi.yaml` | 改前先群里说一声 | 按 tag 分模块改 |

---

## 7. Issue 使用（可选）

在 GitHub Issues 创建任务，标签建议：
- `P0` / `P1` / `P2`
- `user` / `merchant` / `admin` / `docs`
