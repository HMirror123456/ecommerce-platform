# 用户端（C 端网页）

成员 A 负责。对接组长实现的 Express API（`packages/api`）。

## 技术栈

- Vue 3 + Vite + Element Plus + Pinia + Vue Router + Axios

## 已实现功能

- 用户注册 / 登录（手机号 + 密码）
- 个人中心（资料编辑、修改密码、我的订单、我的收藏、收货地址）
- 商品收藏（详情页收藏/取消；个人中心管理）
- 商品列表（分类筛选、分页）
- 商品详情（SKU 规格、加购、立即购买）
- 购物车（改数量、删除、去结算；下单后清除已购 SKU）
- 结算下单（立即购买 / 购物车）
- Mock 支付（倒计时、支付/取消）
- 订单列表 / 详情
- 售后申请（SHIPPED/COMPLETED → REFUNDING）与申请平台介入（→ ESCALATED）

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

1. 注册新账号，或使用演示账号登录：`13800138000` / `123456`
2. 商品详情 → 加入购物车 → 购物车结算 → Mock 支付
3. 或详情页「立即购买」直达结算
4. 「我的订单」查看状态；已发货/已完成订单可申请售后，拒绝后可申请平台介入
5. 商家端验证：`merchant1/123456` 查看待发货与售后

## 主要页面

| 路由 | 说明 |
|------|------|
| `/login` `/register` | 登录 / 注册 |
| `/products` `/products/:spuId` | 商品列表 / 详情 |
| `/cart` | 购物车 |
| `/checkout` | 确认订单 |
| `/user` | 个人中心 · 个人信息 |
| `/user/orders` | 个人中心 · 我的订单 |
| `/user/favorites` | 个人中心 · 我的收藏 |
| `/user/addresses` | 个人中心 · 收货地址 |
| `/orders/:orderId` `/orders/:orderId/pay` | 订单详情 / 支付 |

## 目录结构

```text
src/
  api/          client.js, auth.js, product.js, cart.js, address.js, order.js
  layouts/      UserLayout.vue
  router/       index.js
  stores/       auth.js
  styles/       global.css
  views/        Login/Register/Product*/Cart/Address/Checkout/Order*/Payment
```

## Cursor 开发

```
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
@docs/ui/UI_GUIDE.md
```
