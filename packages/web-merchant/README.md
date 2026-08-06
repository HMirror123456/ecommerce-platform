# 商家后台

成员 B 负责的商家端，用于商家登录、工作台统计、商品管理、商品发布、商品提交审核、订单查看、发货和售后处理。

## 技术栈

- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- Axios

## 启动方式

先启动后端 API：

```bash
cd packages/api
npm install
npm run dev
```

再启动商家端：

```bash
cd packages/web-merchant
npm install
npm run dev
```

- 地址：`http://localhost:5173`
- 演示账号：`merchant1 / 123456`

## 页面

| 路由 | 功能 |
|------|------|
| `/login` | 商家登录 |
| `/dashboard` | 工作台统计和快捷入口 |
| `/products` | 商品列表、搜索、状态筛选、提交审核 |
| `/products/create` | 发布商品 |
| `/orders` | 订单列表、搜索、状态筛选、发货 |
| `/after-sales` | 售后列表、搜索、状态筛选、同意或拒绝售后 |

## 主要功能

- 商品管理：按商品标题、商品 ID、分类 ID 搜索，并按商品状态筛选。
- 商品审核：`DRAFT` 和 `REJECTED` 可提交审核，`PENDING_AUDIT` / `ON_SHELF` 不显示提交审核按钮。
- 订单管理：按订单号、子订单号、商品名、收货信息搜索，并按订单状态筛选。
- 订单发货：待发货订单可填写物流公司和运单号完成发货。
- 售后处理：按售后单号、订单号、子订单号、商品名或申请原因搜索，并按售后状态筛选。
- 售后处理：商家可处理 `APPLIED` 售后；`ESCALATED` 显示为“待平台仲裁”，商家不能处理。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/merchant/login` | 商家登录 |
| GET | `/merchant/dashboard/summary` | 工作台统计 |
| GET | `/merchant/products` | 商品列表 |
| POST | `/merchant/products` | 创建商品 |
| POST | `/merchant/products/:spuId/submit-audit` | 提交审核 |
| GET | `/merchant/orders` | 订单列表 |
| POST | `/merchant/orders/:subOrderId/ship` | 发货 |
| GET | `/merchant/after-sales` | 售后列表 |
| POST | `/merchant/after-sales/:afterSaleId/audit` | 处理售后 |

## 快速验收

1. 使用 `merchant1 / 123456` 登录。
2. 进入 `/dashboard`，查看统计卡片和快捷入口。
3. 进入 `/products`，测试商品搜索、状态筛选和提交审核按钮显示规则。
4. 进入 `/products/create`，创建商品后回到商品列表。
5. 进入 `/orders`，测试订单搜索、状态筛选；待发货订单可点击发货。
6. 进入 `/after-sales`，筛选“待商家处理”，对 `APPLIED` 售后执行同意或拒绝。

## 说明

- 搜索和筛选均为前端本地筛选，不新增后端接口。
- 订单为空是正常情况，需要用户下单并支付后才会出现待发货订单。
- 当前只实现商家处理 `APPLIED` 售后，不实现用户售后申请和 Admin 平台仲裁。
- 当前不包含商品编辑、删除、上下架、图片上传、真实退款和库存回滚。
