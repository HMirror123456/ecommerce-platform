# 售后沟通 / 客服会话（Chat）

> 与 `DOMAIN_MODEL.md`、`ADMIN.md`、`openapi.yaml` 配套。  
> **已交付：** 用户 ↔ 平台客服（`USER_CS`）。  
> **本迭代交付：** 用户 ↔ 商家（`USER_MERCHANT`）——成员 A（用户端）+ 成员 B（商家端）+ API 开聊/鉴权。

## 1. 用户 ↔ 平台客服（USER_CS）

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
| 开聊 | 用户对售后调用 `POST /after-sales/{id}/chat/thread` 幂等创建或返回已有 OPEN 会话；「申请平台介入」成功后自动建会话 |
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
| web-user | 订单详情售后区「联系平台客服」；个人中心「客服会话」 |
| web-admin | 菜单「售后会话」；快捷仲裁按钮 |

---

## 2. 用户 ↔ 商家（USER_MERCHANT）

> **负责人：** 成员 A（`web-user`）+ 成员 B（`web-merchant`）。API/契约与用户侧本迭代落地；商家端 UI 由 B 对接同一套接口。

### 2.1 目标

售后处于 `APPLIED`（商家处理中）时，用户与商家文字协商，减少误升级到平台。

### 2.2 模型

- `ChatThread.type = USER_MERCHANT`
- 绑定 `afterSaleId`、`orderId` / `orderNo`、`userId`；响应中附带 `merchantId`、`shopName`（来自售后）
- 同一 `afterSaleId` + `USER_MERCHANT` 至多一条 OPEN 会话（与 `USER_CS` 可并存）
- 消息 `senderType`：`USER` / `MERCHANT` / `SYSTEM`

### 2.3 规则

| 规则 | 说明 |
|------|------|
| 开聊 | 用户：`POST /after-sales/{id}/merchant-chat/thread` 幂等；商家亦可对本人售后调用同一接口取会话 |
| 可聊状态 | 建议售后为 `APPLIED` 时可新建；已有 OPEN 会话可继续进入（只读/禁发由 `thread.status` 控制） |
| 鉴权 | 用户仅本人；商家仅 `merchantId` 匹配的售后会话 |
| 传输 | 与 USER_CS 相同：HTTP + `afterId` 轮询 |
| 卡片 | 同 USER_CS，`msgType=CARD` |
| 商家快捷 | `MERCHANT_APPROVE` / `MERCHANT_REJECT` → 已有 `POST /merchant/after-sales/{id}/audit`，并写 SYSTEM 消息 |
| 用户升级 | 用户侧提供「仍要申请平台介入」→ 已有 escalate；成功后可再开 `USER_CS` |

### 2.4 API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/after-sales/{afterSaleId}/merchant-chat/thread` | 开聊/取已有 USER_MERCHANT |
| GET | `/chat/threads?type=USER_MERCHANT` | 会话列表（用户见自己的；商家见本店） |
| GET/POST | `/chat/threads/{id}/messages` | 拉/发消息（用户或对应商家） |
| POST | `/chat/threads/{id}/actions/{actionKey}` | 商家：`MERCHANT_APPROVE` / `MERCHANT_REJECT` |

### 2.5 前端入口

| 端 | 入口 | 负责人 |
|----|------|--------|
| web-user | 订单详情售后区「联系商家」抽屉；可「仍要申请平台介入」 | 成员 A |
| web-merchant | 售后列表/详情「回复用户」；快捷同意/拒绝 | 成员 B |

### 2.6 非目标

不做 WebSocket、已读回执、图片、用户↔商家↔平台三方同房。
