# 用户端（C 端网页）

成员 A 负责。对接组长实现的 Express API（`packages/api`）。

## 技术栈

- Vue 3 + Vite + Element Plus + Pinia + Vue Router + Axios

## 已实现功能

- 用户登录（手机号 + 密码）
- 购物车（增删查改、去结算）
- 收货地址管理（增删查改、设默认）
- 确认订单（选地址、立即购买 / 购物车结算）
- Mock 支付页（15 分钟倒计时、支付/取消）

## 启动方式

需先启动后端 API。

```bash
# 终端 1：API
cd packages/api
npm install
npm run dev

# 终端 2：C 端
cd packages/web-user
npm install
npm run dev
```

- 前端地址：`http://localhost:5175`
- API 代理：`/api` → `http://localhost:8080`

## 演示流程

1. 登录：`13800138000` / `123456`
2. 购物车：访问 `/cart`，或通过 API 加购 SKU `1001`
3. 地址管理：`/addresses` 新增/编辑/删除/设默认
4. 结算：
   - 购物车：`/cart` → 去结算
   - 立即购买：`/checkout?spuId=101&skuId=1001&quantity=1`
5. 提交订单 → 支付页 Mock 支付
6. 商家端验证：`merchant1/123456` 查看待发货订单

## 主要页面

| 路由 | 说明 |
|------|------|
| `/login` | 用户登录 |
| `/cart` | 购物车 |
| `/addresses` | 收货地址管理 |
| `/checkout` | 确认订单（`?from=cart` 从购物车） |
| `/orders/:orderId/pay` | 订单支付 |

## API 对接

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/user/login` | 登录 |
| GET/POST | `/cart/items` | 购物车列表/加购 |
| PUT/DELETE | `/cart/items/:itemId` | 改数量/删除 |
| GET/POST | `/users/addresses` | 地址列表/新增 |
| PUT/DELETE | `/users/addresses/:id` | 修改/删除 |
| PATCH | `/users/addresses/:id/default` | 设默认 |
| POST | `/orders` | 创建订单 |

所有接口需 `Authorization: Bearer <user token>`（登录接口除外）。

## 联调脚本

```bash
node scripts/verify-cart-address.mjs
```

## 当前限制

- 用户注册接口未实现
- 商品列表/详情页待下一批 P0
- 购物车/地址为内存存储，重启 API 后清空（用户 seed 地址保留）

## Cursor 开发

```
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
@docs/ui/UI_GUIDE.md
```
