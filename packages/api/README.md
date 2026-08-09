# API 包

## 依赖

- Node.js 18+
- MySQL 8（推荐 Docker，见项目根目录 `docker-compose.yml`）

## 首次启动

```bash
# 1. 启动 MySQL
docker compose up -d

# 2. 配置环境变量
cp .env.example .env

# 3. 安装依赖并建表、种子数据
npm install
npm run db:setup

# 4. 启动 API
npm run dev
```

API 地址：`http://localhost:8080/api`

## 数据库脚本

| 命令 | 说明 |
|------|------|
| `npm run db:migrate` | 执行 `scripts/schema.sql` |
| `npm run db:seed` | 执行 `scripts/seed.sql`（会重置演示数据） |
| `npm run db:setup` | migrate + seed |

## 已持久化（MySQL）

- 管理员、商家、入驻申请、商品审核记录（Batch 1）
- 用户、地址、购物车、订单、支付、售后（Batch 3）

**仍在内存（重启丢失）：** SPU/SKU/库存、类目。见 [`docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)。

## 演示账号

| 角色 | 账号 | 密码 |
|------|------|------|
| C 端用户 | 13800138000 | 123456 |
| 运营 | operator | operator123 |
| 客服 | csagent | cs123 |
| 商家 | merchant1 | 123456 |

## 联调验证

```bash
node ../../scripts/verify-merchant-onboarding.mjs
node ../../scripts/verify-product-audit-history.mjs
node ../../scripts/verify-db-persistence.mjs
```
