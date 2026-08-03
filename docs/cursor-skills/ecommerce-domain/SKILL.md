---
name: ecommerce-domain
description: 电商平台领域知识注入。编写订单、商品、库存、商家、审核相关代码时使用，确保与 docs/domain/DOMAIN_MODEL.md 一致。
---

# 电商领域 Skill

## 何时使用

- 实现订单、支付、购物车、库存
- 实现商品 SPU/SKU、上下架、审核
- 实现商家发货、平台审核
- Review 业务逻辑是否正确

## 核心术语

| 概念 | 说明 |
|------|------|
| SPU | 标准产品，如「某款手机」 |
| SKU | 可售单元，含规格与价格，关联库存 |
| SubOrder | 按商家拆分的子订单（若项目启用拆单） |
| OrderItem | 订单行，含 skuId、quantity、价格快照 |

## 订单状态（不可自创）

```
PENDING_PAYMENT → PAID → PENDING_SHIPMENT → SHIPPED → COMPLETED
PENDING_PAYMENT → CANCELLED
PAID/SHIPPED → REFUNDING → REFUNDED
```

## 库存规则（默认策略，以 ADR-001 为准）

1. 创建订单：lockStock（available → locked）
2. 支付成功：deductStock（locked 减少）
3. 取消/超时：releaseStock（locked → available）

## 商品审核

DRAFT → PENDING_AUDIT → ON_SHELF / REJECTED

C 端仅展示 ON_SHELF 且审核通过的商品。

## 代码检查清单

- [ ] 状态转换是否符合 DOMAIN_MODEL？
- [ ] API 是否与 openapi.yaml 一致？
- [ ] 商家只能操作本店商品/订单？
- [ ] 管理员接口与普通用户分离？

## 引用文档

实现前读取项目内：
- `docs/domain/DOMAIN_MODEL.md`
- `docs/BUSINESS_GLOSSARY.md`
- `docs/api/openapi.yaml`
