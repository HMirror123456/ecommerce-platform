# 售后沟通 / 客服会话（Chat）

> 与 `DOMAIN_MODEL.md`、`ADMIN.md`、`openapi.yaml` 配套。  
> **本次交付：** 用户 ↔ 平台客服（`USER_CS`）可实现。  
> **仅需求、不实现：** 用户 ↔ 商家（`USER_MERCHANT`），由成员 A/B 后续排期。

## 1. 用户 ↔ 平台客服（USER_CS）— 要实现

### 1.1 实体

**ChatThread（会话）**

| 字段 | 说明 |
|------|------|
| id | 主键 |
| type | 固定 `USER_CS` |
| afterSaleId | 关联售后 |
| orderId / orderNo | 关联订单（卡片展示） |
| userId | 用户 |
| status | `OPEN` / `CLOSED` |
| createdAt / updatedAt | 时间 |

**ChatMessage（消息）**

| 字段 | 说明 |
|------|------|
| id | 主键 |
| threadId | 会话 |
| senderType | `USER` / `CS_AGENT` / `SYSTEM` |
| senderId | 用户 id 或 admin id；SYSTEM 可空 |
| msgType | `TEXT` / `CARD` / `QUICK_ACTION` |
| content | 展示文案 |
| payloadJson | 卡片或动作附加数据 |
| createdAt | 时间 |

### 1.2 规则

| 规则 | 说明 |
|------|------|
| 开聊 | 用户对售后调用 `POST /after-sales/{id}/chat/thread` 幂等创建或返回已有 OPEN 会话；建议在「申请平台介入」成功后也可自动建会话 |
| 一人一单 | 同一 `afterSaleId` 仅一条 OPEN 的 `USER_CS` |
| 鉴权 | 用户仅本人会话；`CS_AGENT`/`SUPER_ADMIN` 可进全部 `USER_CS` |
| 传输 | HTTP 发消息 + 客户端 3–5s 轮询 `messages?afterId=`；无 WebSocket |
| 快捷动作 | 仅客服：`CS_APPROVE` / `CS_REJECT` → 已有 arbitrate；`HINT_RETURN` → 仅 SYSTEM 文案 |
| 卡片 | `msgType=CARD`，payload 含 orderNo、金额摘要、售后状态等 |

### 1.3 API 摘要

见 `openapi.yaml`：`/after-sales/{id}/chat/thread`、`/chat/threads`、`/chat/threads/{id}/messages`、`/chat/threads/{id}/actions/{actionKey}`。

### 1.4 前端入口

| 端 | 入口 |
|----|------|
| web-user | 订单详情售后区「联系平台客服」抽屉 |
| web-admin | 菜单「售后会话」+ 售后仲裁页可跳转；快捷仲裁按钮 |

---

## 2. 预留：用户 ↔ 商家（USER_MERCHANT）— 仅功能要求，本次不交付代码

> **负责人：** 成员 A（用户端）+ 成员 B（商家端）。**状态：未排期。**

### 2.1 目标

售后处于 `APPLIED`（或商家处理中）时，用户与商家文字协商，减少误升级到平台。

### 2.2 建议模型

- `ChatThread.type = USER_MERCHANT`
- 绑定 `afterSaleId`、`orderId`、`userId`、`merchantId`
- 同一售后仅一条 OPEN 会话
- 消息 `senderType`：`USER` / `MERCHANT` / `SYSTEM`

### 2.3 建议能力

- 文字消息；订单/售后摘要卡片
- 商家快捷：同意/拒绝售后（对接已有 `POST /merchant/after-sales/{id}/audit`），并写 SYSTEM 消息
- 用户侧展示商家回复；可选「仍要申请平台介入」跳转现有 escalate

### 2.4 建议入口

| 端 | 入口 |
|----|------|
| web-user | 售后详情「联系商家」 |
| web-merchant | 售后列表/详情「回复用户」 |

### 2.5 非目标（与 USER_CS 相同）

不做 WebSocket、已读回执、图片、用户↔商家↔平台三方同房。
