# 用户端（C 端网页）

成员 A 负责。对接组长实现的 Express API（`packages/api`）。

## 技术栈

- Vue 3 + Vite + Element Plus + Pinia + Vue Router + Axios

## 已实现功能

- 用户登录（手机号 + 密码）
- 立即购买结算页（通过 URL query 传入商品）
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

1. 访问结算页（未登录会跳转登录）：
   `http://localhost:5175/checkout?spuId=101&skuId=1001&quantity=1`
2. 使用演示账号登录：`13800138000` / `123456`
3. 确认商品与地址，点击「提交订单」
4. 在支付页点击「立即支付」完成 Mock 支付
5. 商家端验证：登录 `merchant1/123456`，在订单列表查看 `PENDING_SHIPMENT` 订单

## 主要页面

| 路由 | 说明 |
|------|------|
| `/login` | 用户登录 |
| `/checkout?spuId=&skuId=&quantity=` | 确认订单（立即购买） |
| `/orders/:orderId/pay` | 订单支付 |

## 当前限制

- 收货地址固定为演示数据（`addressId=1`），地址管理待 P1 实现
- 购物车 API 未实现，暂通过 URL query 或路由 state 传入商品
- 用户注册接口后端未实现

## 目录结构

```text
src/
  api/          client.js, auth.js, product.js, order.js
  layouts/      UserLayout.vue
  router/       index.js
  stores/       auth.js
  styles/       global.css
  views/        LoginView.vue, CheckoutView.vue, PaymentView.vue
```

## Cursor 开发

```
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
@docs/ui/UI_GUIDE.md
```
