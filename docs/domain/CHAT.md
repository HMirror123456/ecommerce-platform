# 售后沟通 / 客服会话（Chat）

> 与 `DOMAIN_MODEL.md`、`ADMIN.md`、`openapi.yaml` 配套。  
> **已交付：** 用户 ↔ 平台客服（`USER_CS`）。  
> **本迭代交付：** 用户 ↔ 商家（`USER_MERCHANT`）——成员 A（用户端）+ 成员 B（商家端）+ API 开聊/鉴权。
> **本次交付：** 用户 ↔ 平台客服（`USER_CS`）与商家端用户 ↔ 商家（`USER_MERCHANT`）基础沟通可实现。
> 用户端「联系商家」入口由成员 A 后续接入。

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
| 开聊 | 用户对售后调用 `POST /after-sales/{id}/chat/thread`：已有 OPEN 直接返回；**新建仅 `ESCALATED`**（与「联系平台客服」一致）；「申请平台介入」成功后自动建会话 |
| 一人一单 | 同一 `afterSaleId` 仅一条 OPEN 的 `USER_CS`（关闭后可因再次升级再建） |
| 关闭 | 售后 `REFUNDED`/`REJECTED` 自动关闭；**升级仲裁时关闭商家会话**；平台仲裁同意退货（→`APPROVED`）仅关 `USER_CS`；参与方可 `POST /chat/threads/{id}/close` |
| 仲裁禁言 | 售后 `ESCALATED`/`REFUNDED` 时售后商家会话双方不可再发消息；请走 `USER_CS` |
| 鉴权 | 用户仅本人会话；`CS_AGENT`/`SUPER_ADMIN` 可进全部 `USER_CS` |
| 传输 | HTTP 发消息 + 客户端 3–5s 轮询 `messages?afterId=`；无 WebSocket |
| 快捷动作 | 仅客服：`CS_APPROVE` / `CS_REJECT` → 已有 arbitrate；`HINT_RETURN` → SYSTEM 文案，指引用户到订单详情「填写寄回物流」；`SET_ORDER_STATUS` → 更改关联订单状态（见下） |
| 卡片 | `msgType=CARD`，payload 含 orderNo、金额摘要、售后状态等 |
| 更改订单状态 | 售后会话聊天头「更改订单状态」入口常显（有关联订单即可）。仅主单为 `REFUNDING` 时可成功提交；目标仅 `SHIPPED` / `COMPLETED` / `REFUNDED`；`reason` 必填。目标为 `REFUNDED` 时关联售后标 `REFUNDED` 并回补库存；目标为 `SHIPPED`/`COMPLETED` 时若售后仍进行中则标 `REJECTED`。写 SYSTEM 消息，线程列表展示 `orderStatus` |

### 1.3 API 摘要

见 `openapi.yaml`：`/after-sales/{id}/chat/thread`、`/chat/threads`、`/chat/threads/{id}/messages`、`/chat/threads/{id}/close`、`/chat/threads/{id}/actions/{actionKey}`。

### 1.4 前端入口

| 端 | 入口 |
|----|------|
| web-user | 订单详情售后区「联系平台客服」；个人中心「沟通会话」 |
| web-admin | 菜单「售后会话」；快捷仲裁按钮 |
| web-user | 订单详情售后区「联系平台客服」；个人中心「客服会话」 |
| web-admin | 菜单「售后会话」；快捷仲裁；更改订单状态 |

---

## 2. 用户 ↔ 商家（USER_MERCHANT）

> **负责人：** 成员 A（`web-user`）+ 成员 B（`web-merchant`）。API/契约与用户侧本迭代落地；商家端 UI 由 B 对接同一套接口。
## 2. 用户 ↔ 商家（USER_MERCHANT）— 基础沟通

> **负责人：** 成员 A（用户端）+ 成员 B（商家端）。**当前交付：** 后端、商家端入口和聊天抽屉；用户端入口待成员 A 接入。

### 2.1 目标

1. **售前/履约沟通**：订单已支付待发货（`PENDING_SHIPMENT`）时，用户可联系对应店铺商家（如改规格/颜色、催发货）。
2. **售后协商**：售后处于 `APPLIED` 时，用户与商家文字协商，减少误升级到平台。

### 2.2 模型

- `ChatThread.type = USER_MERCHANT`
- **售后会话**：绑定 `afterSaleId` + `orderId` / `orderNo` + `userId` + `merchantId`
- **订单会话**：`afterSaleId` 为空；绑定 `orderId` / `orderNo` + `userId` + `merchantId`（一单一店至多一条 OPEN）
- 绑定 `afterSaleId`、`orderId`、`userId`；`merchantId` 通过关联售后单解析，避免冗余存储
- 同一售后仅一条 OPEN 会话
- 消息 `senderType`：`USER` / `MERCHANT` / `SYSTEM`

### 2.3 规则

| 规则 | 说明 |
|------|------|
| 售后开聊 | `POST /after-sales/{id}/merchant-chat/thread`（及商家 `POST /merchant/after-sales/{id}/chat/thread`）；已有 OPEN 直接返回。用户新建允许 `APPLIED`/`REJECTED`/`APPROVED`/`RETURNING`；商家可在 `APPLIED`/`APPROVED`/`RETURNING`/`REJECTED`/`ESCALATED` 新建或进入。`ESCALATED`/`REFUNDED` 时商家发消息被服务端拒绝 |
| 订单开聊 | `POST /orders/{orderId}/merchant-chat/thread`（body: `merchantId` 或 `subOrderId`）；订单属本人且目标子单/整单为待发货等可沟通状态 |
| 关闭 | 售后 `REFUNDED`/`REJECTED` 自动关闭；升级 `ESCALATED` 关闭商家会话；整单退款/取消关闭订单级会话；可主动结束。拒绝后可重新联系商家（新建 OPEN） |
| 查看历史 | `GET /after-sales/{id}/merchant-chat/thread`、`GET .../chat/thread` 返回最近会话（含 CLOSED），不新建 |
| 鉴权 | 用户仅本人；商家仅本店 `merchantId` 匹配的会话 |
| 传输 | 与 USER_CS 相同：HTTP + `afterId` 轮询 |
| 卡片 | 售后会话发卡含售后摘要；订单会话发卡含订单/店铺摘要 |
| 商家快捷 | 仅**售后会话**：`MERCHANT_APPROVE` / `MERCHANT_REJECT` → audit API |
| 用户升级 | 售后会话可「仍要申请平台介入」→ escalate |

### 2.4 API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/after-sales/{afterSaleId}/merchant-chat/thread` | 售后商家会话 |
| POST | `/orders/{orderId}/merchant-chat/thread` | 订单商家会话（未发货沟通） |
| GET | `/chat/threads?type=USER_MERCHANT` | 会话列表 |
| GET/POST | `/chat/threads/{id}/messages` | 拉/发消息 |
| POST | `/chat/threads/{id}/close` | 主动关闭会话 |
| POST | `/chat/threads/{id}/actions/{actionKey}` | 商家售后快捷动作 |

### 2.5 前端入口

| 端 | 入口 | 负责人 |
|----|------|--------|
| web-user | 订单详情「履约信息」待发货店铺旁「联系商家」；售后区「联系商家」 | 成员 A |
| web-merchant | 侧栏「用户沟通」会话列表（含订单级）；售后列表「回复用户」 | 成员 B |

### 2.6 非目标

不做 WebSocket、已读回执、图片、用户↔商家↔平台三方同房；不做真实改 SKU 下单回写（仅沟通，改色等由商家线下/后台处理）。
- 文字消息；订单/售后摘要卡片
- 商家可发送文字消息；售后审核仍通过现有售后处理页，不在聊天中绕过状态机
- 用户侧展示商家回复；可选「仍要申请平台介入」跳转现有 escalate

### 2.4 建议入口

| 端 | 入口 |
|----|------|
| web-user | 售后详情「联系商家」（待成员 A 接入） |
| web-merchant | 售后列表「回复用户」抽屉 |

### 2.5 非目标（与 USER_CS 相同）

不做 WebSocket、已读回执、图片、用户↔商家↔平台三方同房。
