# 后端 API

组长主责。当前为 W1 内存 Mock 实现，对齐 `docs/api/openapi.yaml`。

## 启动

```bash
cd packages/api
npm install
npm run dev   # Node 14+ 可用；改代码后需手动重启
```

> **Node 版本**：当前脚本兼容 **Node 14+**。若使用 Node 18+，可将 `dev` 改为 `node --watch src/index.js` 实现热重载。建议全组升级到 **Node 18 LTS**。

默认地址：`http://localhost:8080/api`

## 演示账号

| 端 | 账号 | 密码 | 说明 |
|----|------|------|------|
| C 端用户 | 13800138000 | 123456 | userId=1，默认地址 id=1 |
| 商家 | merchant1 | 123456 | merchantId=1，数码旗舰店 |
| 商家 | merchant2 | 123456 | merchantId=2，家居生活馆 |
| 平台 | operator | operator123 | OPERATOR（商品审核） |
| 平台 | csagent | cs123 | CS_AGENT |

## 认证

- `POST /auth/user/login` — body: `{ "phone", "password" }` → `{ token, userId }`
- `POST /auth/merchant/login` — body: `{ "username", "password" }` → `{ token, merchantId, shopId, shopName }`
- `POST /auth/admin/login` — body: `{ "username", "password" }`

后续订单/商家接口请在 Header 携带：`Authorization: Bearer TOKEN`

## 订单接口（C 端，需用户 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/orders` | 创建订单。body: `{ addressId, items: [{ skuId, quantity }], remark? }`。锁定库存，按 merchantId 拆子单，状态 `PENDING_PAYMENT`，15 分钟支付超时 |
| GET | `/orders` | 用户订单列表，可选 query `status` |
| GET | `/orders/:id` | 订单详情（含 subOrders、addressSnapshot） |
| POST | `/orders/:id/pay` | Mock 支付：`PENDING_PAYMENT` → `PENDING_SHIPMENT`，扣减锁定库存 |
| POST | `/orders/:id/cancel` | 取消待支付订单，释放锁定库存 → `CANCELLED` |

超时未支付订单在读写订单相关数据时会自动关闭（`expirePendingOrders`）。

### 创建订单示例

先 `POST /auth/user/login` 获取 token，再：

`POST /orders` with body `{"addressId":1,"items":[{"skuId":1001,"quantity":1},{"skuId":1003,"quantity":1}]}`

（SKU 1001 与 1003 分属两个商家，会生成两个 subOrder。）

## 商家接口（需商家 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/orders` | 本子订单列表，可选 query `status` |
| POST | `/merchant/orders/:subOrderId/ship` | 发货。body: `{ logisticsCompany, trackingNo }`，子单 `PENDING_SHIPMENT` → `SHIPPED` |

## Admin 接口

- `GET /admin/products/pending`
- `GET /admin/products/:spuId`
- `POST /admin/products/:spuId/audit` — `PENDING_AUDIT` → `ON_SHELF` | `REJECTED`

## 业务规则

- 库存：`stock.available` / `stock.locked`；下单锁定，支付扣减锁定，取消/超时释放
- 仅 `ON_SHELF` SPU 可下单（演示数据：SPU 101、102 上架，103 待审核）
- 订单项保存商品快照（title、price）
- 仅 `OPERATOR` 可访问商品审核接口