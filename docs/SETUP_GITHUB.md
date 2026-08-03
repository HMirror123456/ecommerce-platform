# GitHub 仓库创建指南

本地项目已初始化并完成首次提交。因本机尚未登录 GitHub CLI，请按以下步骤创建远程仓库并邀请组员。

## 1. 登录 GitHub（只需一次）

在终端执行：

```powershell
gh auth login
```

按提示选择：
- GitHub.com
- HTTPS
- Login with a web browser（或 Paste an authentication token）

## 2. 创建远程仓库并推送

在项目根目录执行：

```powershell
cd C:\Users\Lenovo\Projects\ecommerce-platform

gh repo create ecommerce-platform --public --source=. --remote=origin --description "类京东电商平台小组项目（3人3周）" --push
```

若仓库名已被占用，可改名，例如 `ecommerce-platform-team2026`：

```powershell
gh repo create ecommerce-platform-team2026 --public --source=. --remote=origin --push
```

## 3. 推送 develop 分支

```powershell
git push -u origin develop
```

## 4. 邀请组员

```powershell
gh repo collaborator add <组员GitHub用户名> --permission push
```

或在 GitHub 网页：Settings → Collaborators → Add people

## 5. 组员 Clone

```powershell
git clone https://github.com/<你的用户名>/ecommerce-platform.git
cd ecommerce-platform
git checkout develop
```

## 6. 可选：分支保护

在 GitHub Settings → Branches 为 `main` 设置：
- Require pull request before merging
- Require 1 approval（若三人 Review）

---

**当前本地状态**
- 路径：`C:\Users\Lenovo\Projects\ecommerce-platform`
- 分支：`main`（已提交）、`develop`（待推送）
- 首次 commit：`chore: initialize project structure and docs templates`
