# MySQL 迁移分工（Batch 2 / 3）

> **Batch 1 + 3 已落库**：`admins`, `merchants`, `merchant_applications`, `product_audits`, `users`, `addresses`, `cart_items`, `orders`, `sub_orders`, `order_items`, `payments`, `after_sales`  
> **Batch 2 仍在内存**：`categories`, `spus`（含 SKU/库存），见 [`store.js`](../packages/api/src/data/store.js)。

## 三人共享同一数据库

1. 组长机器或云服务器：`docker compose up -d`
2. 组内共享 `.env`（勿提交 git）：

```env
DB_HOST=<共享主机IP或localhost>
DB_PORT=3306
DB_USER=ecommerce
DB_PASSWORD=ecommerce123
DB_NAME=ecommerce
```

3. 首次：`cd packages/api && npm install && npm run db:setup`

## 迁移顺序（与 DOMAIN_MODEL §7 一致）

| 批次 | 负责人 | 表 | 状态 |
|------|--------|-----|------|
| **1** | 组长 | `admins`, `merchants`, `merchant_applications`, `product_audits` | ✅ 已接 MySQL |
| **2** | B | `categories`, `spus`, `skus`, `stocks` | 内存（`categories`, `spus`） |
| **3a** | A | `users`, `addresses`, `cart_items` | ✅ 已接 MySQL |
| **3b** | 组长 | `orders`, `order_items`, `sub_orders`, `payments`, `after_sales` | ✅ 已接 MySQL |

## 推荐接库步骤（每个模块）

1. 在 [`scripts/schema.sql`](../scripts/schema.sql) 追加 `CREATE TABLE`（群里先通知）
2. 新建 `packages/api/src/repositories/xxxRepo.js`（参考 `merchantRepo.js`）
3. 将 `store.js` 中对应 `export function` 改为 `async`，调用 repository
4. 路由 handler 加 `async/await`
5. 在 [`scripts/seed.sql`](../scripts/seed.sql) 补充演示数据
6. 更新 [`openapi.yaml`](../docs/api/openapi.yaml)（若字段有变）

## 库存并发（Batch 2 必做）

```sql
UPDATE stocks SET available = available - ? WHERE sku_id = ? AND available >= ?
```

## 禁止

- 不要引入组内未确认的 ORM
- 不要「内存 + DB 双写」长期并存
- 不要提交 `.env` 或真实密码
