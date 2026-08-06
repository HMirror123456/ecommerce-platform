# 商家后台

成员 B 负责的商家后台前端工程，用于商家登录、商品管理、商品发布、订单查看和发货。

## 技术栈

- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- Axios

## 已实现功能

- 商家登录
- 工作台
- 商品管理
- 商品发布
- 商品提交审核
- 订单管理
- 商家发货

## 启动方式

需先启动后端 API。

```bash
cd packages/web-merchant
npm install
npm run dev
```

- 前端地址：`http://localhost:5173`
- API 代理：`/api` -> `http://localhost:8080`

## 构建方式

```bash
cd packages/web-merchant
npm run build
```

## 主要页面

| 路由 | 说明 |
|------|------|
| `/login` | 商家登录 |
| `/dashboard` | 工作台 |
| `/products` | 商品管理 |
| `/products/create` | 发布商品 |
| `/orders` | 订单管理 |

## 当前接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/merchant/login` | 商家登录 |
| GET | `/merchant/products` | 获取当前商家的商品列表 |
| POST | `/merchant/products` | 创建商品草稿 |
| POST | `/merchant/products/:spuId/submit-audit` | 提交商品审核 |
| GET | `/merchant/orders` | 获取当前商家的订单列表 |
| POST | `/merchant/orders/:subOrderId/ship` | 商家发货 |

登录成功后会保存商家会话信息到 `localStorage`，key 为 `merchant_auth`。

## 简单测试流程

1. 启动后端 API 和商家端前端。
2. 使用商家账号登录。
3. 进入商品管理 `/products`。
4. 点击发布商品，填写商品和 SKU 信息。
5. 创建成功后返回商品列表，商品状态为 `DRAFT`。
6. 点击提交审核，商品状态变为 `PENDING_AUDIT`。
7. 用户下单并支付后，商家可在订单管理 `/orders` 查看待发货订单。
8. 对待发货订单填写物流公司和运单号完成发货。

## 注意事项

- 订单管理为空是正常的，需要用户下单并支付后才会出现待发货订单。
- 旧 mock 商品可能没有 `categoryId`，所以分类 ID 会显示为 `-`。
- 当前未实现商品编辑、删除、上下架和图片上传。

## 目录结构

```text
src/
  api/
    client.js
    merchant.js
  layouts/
    MerchantLayout.vue
  router/
    index.js
  stores/
    auth.js
  styles/
    global.css
  views/
    DashboardView.vue
    LoginView.vue
    OrderListView.vue
    ProductCreateView.vue
    ProductListView.vue
  App.vue
  main.js
```
