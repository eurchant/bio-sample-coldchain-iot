# Git 团队协作规范

本项目当前采用 `main` 加四个个人分支的简单协作模式，暂不额外创建 `develop` 分支。

## 分支用途

- `main`：稳定演示版本
- `zy`：赵耀个人开发分支
- `ljy`：Web 管理端成员分支
- `zrq`：小程序 A 成员分支
- `tkx`：小程序 B 成员分支

## 每天开始开发前

将下面命令中的“自己的分支”替换为 `zy`、`ljy`、`zrq` 或 `tkx`：

```bash
git checkout 自己的分支
git pull origin 自己的分支
git merge main
```

如果出现冲突，不允许盲目覆盖，先联系总负责人，由相关成员共同确认保留内容。

## 每天完成开发后

```bash
git status
git add .
git commit -m "类型: 简要说明"
git push origin 自己的分支
```

执行 `git add .` 前必须查看 `git status`，确认没有数据库、环境变量、虚拟环境、缓存或其他私密文件。

## 推荐提交格式

- `feat`：新增功能
- `fix`：修复问题
- `docs`：修改文档
- `refactor`：重构代码
- `test`：增加测试
- `chore`：工程配置调整

示例：

```bash
git commit -m "feat: 完成转运任务列表页面"
git commit -m "fix: 修复设备数据上传字段错误"
git commit -m "docs: 更新接口说明"
```

## 禁止事项

- 禁止直接向 `main` 提交未经验证的代码
- 禁止 force push
- 禁止上传 `.env`、Token、数据库、虚拟环境
- 禁止删除他人的代码
- 禁止随意修改公共接口字段
- 禁止把未完成和无法运行的代码合并到 `main`

## 合并流程

```text
个人分支推送
→ 在 GitHub 发起 Pull Request
→ 合并目标选择 main
→ 总负责人查看代码
→ 在总负责人 Mac 上测试
→ 测试通过后合并
```

合并完成后，各成员应在下一次开发前将最新 `main` 合并到自己的分支。
