# 商家后台

成员 B 负责。当前为商家后台前端基础工程。

## 技术栈

- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- Axios

## 启动

需先启动后端 API。

```bash
cd packages/web-merchant
npm install
npm run dev
```

- 前端地址：`http://localhost:5173`
- API 代理：`/api` -> `http://localhost:8080`

## 脚本

```bash
npm run dev
npm run build
npm run preview
```

## 当前页面

| 路由 | 说明 |
|------|------|
| `/login` | 商家登录 |
| `/dashboard` | 商家后台工作台占位页 |

## 当前接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/merchant/login` | 商家登录 |

登录成功后会保存商家会话信息到 `localStorage`，key 为 `merchant_auth`。

## 目录结构

```text
src/
  api/
    client.js       # Axios 实例、Token 注入、401 处理
    merchant.js     # 商家登录接口
  layouts/
    MerchantLayout.vue
  router/
    index.js
  stores/
    auth.js
  styles/
    global.css
  views/
    LoginView.vue
    DashboardView.vue
  App.vue
  main.js
```
