# Cursor / AI 协作配置指南

> 三人都用 Cursor 时，共用同一套规则和文档，AI 输出才一致。

## 1. 必做清单（每人 Clone 后 10 分钟）

- [ ] Clone 仓库并打开项目根目录
- [ ] 确认 `.cursor/rules/project.mdc` 存在（已随仓库提交）
- [ ] 阅读 `docs/BUSINESS_GLOSSARY.md` + `docs/domain/DOMAIN_MODEL.md`
- [ ] 在 Cursor 中 @ 引用上述文档再开始写代码
- [ ] 技术栈确认后，更新 `README.md` 和本文件第 3 节

---

## 2. 仓库内已提供的 AI 规则

路径：`.cursor/rules/project.mdc`

规则会在本项目中自动生效，内容包括：
- 业务上下文（订单状态、SPU/SKU）
- 代码与 API 约定
- 禁止 AI 臆造未定义实体

**修改规则：** 组内讨论后由组长提 PR，不要每人本地改不同版本。

---

## 3. 推荐 Skill（可选，进阶）

若需更强约束，可在每人本地创建 Skill（路径因 Cursor 版本而异，常见为 `.cursor/skills/`）。

仓库模板：`docs/cursor-skills/ecommerce-domain/SKILL.md`

复制到本地：
```text
.cursor/skills/ecommerce-domain/SKILL.md
```

Skill 作用：写订单/库存相关代码时，自动注入领域模型摘要。

---

## 4. MCP 建议（按需，不必全员相同）

| MCP | 是否推荐 | 用途 |
|-----|----------|------|
| GitHub | 推荐 | Issue、PR、Review |
| Browser | 可选 | 本地联调截图 |
| Figma | 有设计稿时 | 对齐 UI |

**原则：** 核心靠 `docs/` + `.cursor/rules`，MCP 是辅助。在 README 记录谁用了什么，避免环境差异导致「我这能跑你那不行」。

---

## 5. 与 AI 协作的最佳实践

### 5.1 开新功能前
在 Chat 中提供：
```
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
我要实现：商家发货接口，订单状态从 PENDING_SHIPMENT → SHIPPED
```

### 5.2 禁止
- 不让 AI 凭空设计新的订单状态（必须先改 DOMAIN_MODEL）
- 不让 AI 一次生成整个项目（按模块迭代）
- 不复制粘贴未 Review 的大段代码

### 5.3 推荐
- 先让 AI 出接口签名 / 表结构，人工确认后再实现
- 生成的业务逻辑对照状态机自检一遍
- 关键逻辑在 PR 描述里写「为什么这样设计」

---

## 6. 共用文档优先级（AI 上下文）

写代码时按优先级 @ 引用：

1. `docs/domain/DOMAIN_MODEL.md`
2. `docs/BUSINESS_GLOSSARY.md`
3. `docs/api/openapi.yaml`
4. `docs/prd/PRD.md`
5. `docs/ui/UI_GUIDE.md`

---

## 7. 常见问题

**Q：三人 AI 生成的接口字段不一致？**  
A：以 `openapi.yaml` 为准，改接口先改 YAML 再写代码。

**Q：AI 用了没定义的表/状态？**  
A：补充到 DOMAIN_MODEL 或 GLOSSARY，再重新生成。

**Q：需要提交 `.cursor/` 吗？**  
A：提交 `rules/`；个人 MCP 配置、API Key 不要提交。
