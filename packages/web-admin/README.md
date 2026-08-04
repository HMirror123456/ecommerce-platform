# 平台管理后台

组长负责。业务与 API 详见 [`docs/domain/ADMIN.md`](../../docs/domain/ADMIN.md)。

## 页面路由

| 路由 | 页面 | 优先级 |
|------|------|--------|
| `/login` | 管理员登录 | P0 |
| `/audit/products` | 商品审核 | P0 |
| `/dashboard` | 工作台待办 | P1 |
| `/orders` | 全平台订单查询 | P1 |
| `/after-sales` | 售后仲裁 | P1 |
| `/audit/merchants` | 商家入驻审核 | P1 |

## 本地启动

```bash
cd packages/web-admin
npm install
npm run dev
```

## Cursor 开发

```
@docs/domain/ADMIN.md
@docs/domain/DOMAIN_MODEL.md
@docs/api/openapi.yaml
@docs/ui/UI_GUIDE.md
```

## W2 联调顺序

1. B 商家提交商品审核 → 本端审核通过
2. A 用户浏览/下单/支付 → 本端查订单
3. B 商家发货 → A 用户看到已发货
4. W3：A 申请售后 → B 审核 → 本端仲裁
