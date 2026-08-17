# 商家后台

成员 B 负责的商家端，用于商家入驻申请、入驻状态查询、商家登录、店铺信息展示、工作台统计、商品管理、商品发布、商品提交审核、订单查看、发货和售后处理。

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
- 辅助商家账号：`merchant2 / 123456`，用于权限边界验证

## 页面

| 路由 | 功能 |
|------|------|
| `/login` | 商家登录 |
| `/onboarding` | 商家入驻申请、入驻进度查询 |
| `/dashboard` | 店铺信息、工作台统计、低库存/缺货提醒和今日待办 |
| `/products` | 商品列表、服务端搜索/筛选/分页、低库存筛选、批量提交审核、批量下架、SKU 库存调整 |
| `/products/create` | 发布商品，主图 URL 校验、预览和默认图 |
| `/products/:spuId/edit` | 编辑商品，展示已有主图预览 |
| `/orders` | 订单列表、搜索、状态筛选、发货 |
| `/after-sales` | 售后列表、搜索、状态筛选、售后流程时间线、同意/拒绝售后、退货验收 |
| `/chats` | 用户沟通、历史会话只读查看和未读消息提醒 |

## 主要功能

- 商家入驻：未登录访客可提交店铺名称、联系人、联系电话，提交后状态为 `PENDING`，等待平台审核。
- 入驻状态：可按申请手机号查询 `PENDING` / `APPROVED` / `REJECTED`；驳回展示原因，通过后展示商家账号。
- 店铺信息：商家登录后在工作台展示商家 ID、登录账号、店铺 ID、店铺名称，数据来自已有商家账号。
- 商品管理：按商品标题、商品 ID、类目和状态进行服务端搜索/筛选，并支持分页、pageSize 切换。
- 商品管理：可创建商品、编辑 `DRAFT` / `REJECTED` / `OFF_SHELF` 商品，`ON_SHELF` 商品可下架。
- 批量操作：可批量提交 `DRAFT` / `REJECTED` / `OFF_SHELF` 商品审核；可批量下架 `ON_SHELF` 商品，后端逐条校验归属和状态并返回失败原因。
- 商品主图：发布和编辑时校验 http/https 图片 URL，输入合法 URL 后展示预览，加载失败显示占位提示，可一键填入默认图。
- 商品审核：`DRAFT` 可提交审核；`REJECTED` / `OFF_SHELF` 可重新提交审核；`PENDING_AUDIT` / `ON_SHELF` 不显示提交审核按钮。
- 库存管理：商品列表按 SKU 展示 `available` / `locked`；商家可调整 `available` 可用库存，`locked` 锁定库存只读。
- 库存预警：仅统计已上架商品；任一 SKU 可用库存为 `0` 时为缺货，未缺货且任一 SKU 可用库存小于 `10` 时为低库存。两者按商品数统计且互斥，缺货优先。
- 订单管理：按订单号、子订单号、商品名、收货信息搜索，并按订单状态筛选。
- 订单发货：待发货订单可填写物流公司和运单号完成发货。
- 售后处理：按售后单号、订单号、子订单号或商品名搜索，并按售后状态筛选。
- 售后处理：商家可处理 `APPLIED` 售后，同意后进入退款或退货流程，拒绝时必须填写原因；售后列表可直接回复用户或查看只读历史沟通。
- 售后进度：按售后类型和当前状态展示申请、审核、寄回、验收、退款等流程节点；拒绝和平台仲裁显示终态说明，不虚构缺失时间。
- 售后边界：`ESCALATED` 显示为“待平台仲裁”，商家端只读展示，平台仲裁不在商家端处理。
- 售后退货：`RETURNING` 退货退款单可由商家验收通过并完成 Demo 退款，后端会执行库存回滚并更新关联订单状态。
- 用户沟通：支持查看售后历史会话并跳转对应售后单；已关闭、已退款或仲裁会话只读展示，侧边栏和会话列表显示未读消息数量。
- 数据持久化：商品类目、SPU、SKU、库存已切换 MySQL，库存锁定、扣减、释放和退款回滚走后端接口。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/merchant/login` | 商家登录 |
| POST | `/merchant/applications` | 提交商家入驻申请 |
| GET | `/merchant/applications/status` | 查询入驻申请状态 |
| GET | `/merchant/dashboard/summary` | 工作台统计 |
| GET | `/merchant/products` | 商品列表 |
| POST | `/merchant/products` | 创建商品 |
| GET | `/merchant/products/:spuId` | 商品详情 |
| PUT | `/merchant/products/:spuId` | 编辑商品 |
| POST | `/merchant/products/:spuId/submit-audit` | 提交审核或重新提交审核 |
| POST | `/merchant/products/:spuId/off-shelf` | 下架商品 |
| POST | `/merchant/products/batch-submit-audit` | 批量提交审核 |
| POST | `/merchant/products/batch-off-shelf` | 批量下架商品 |
| PATCH | `/merchant/skus/:skuId/stock` | 调整 SKU 可用库存 |
| GET | `/merchant/orders` | 订单列表 |
| POST | `/merchant/orders/:subOrderId/ship` | 发货 |
| GET | `/merchant/after-sales` | 售后列表 |
| POST | `/merchant/after-sales/:afterSaleId/audit` | 处理售后 |
| POST | `/merchant/after-sales/:afterSaleId/confirm-return` | 验收退货并退款 |

## 快速验收

1. 进入 `/onboarding`，提交入驻申请并按手机号查询进度。
2. 使用 `merchant1 / 123456` 登录。
3. 进入 `/dashboard`，查看店铺信息、统计卡片、低库存/缺货提醒和今日待办。
4. 进入 `/products`，测试服务端搜索、状态/类目/库存预警筛选、分页、批量提交审核、批量下架、编辑、下架、提交审核按钮显示规则和 SKU 库存调整。
5. 进入 `/products/create`，创建商品后回到商品列表；`DRAFT` / `REJECTED` / `OFF_SHELF` 可提交或重新提交审核。
6. 进入 `/orders`，测试订单搜索、状态筛选；待发货订单可点击发货。
7. 进入 `/after-sales`，查看售后流程时间线；筛选“待商家处理”，对 `APPLIED` 售后执行同意或拒绝；对 `RETURNING` 售后执行验收退款；`ESCALATED` 仅展示“待平台仲裁”。
8. 进入 `/chats`，查看会话未读数量；已关闭、已退款或仲裁的售后会话仅查看历史记录。

## 常见问题与排查

- API 旧进程导致新路由 404：停止旧的 `packages/api` dev 进程并重新启动。
- 本地 MySQL 缺迁移字段：在 `packages/api` 执行 `npm run db:setup`，会重置演示数据。
- Docker 不可用：确认 Docker Desktop 已启动；或手动准备 MySQL 8 并配置 API `.env`。
- Vite chunk size warning：这是构建体积提示，不影响 `npm run build` 成功。
