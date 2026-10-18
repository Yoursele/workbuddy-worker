---
name: workbuddy-worker
description: Delegate bounded text, code-review, CSV extraction and document-drafting tasks to installed Windows WorkBuddy in the background, then query status, retrieve artifacts or cancel owned jobs. Does not control its GUI or grant production/file-edit access.
---

# WorkBuddy 后台协作

通过本机 WorkBuddy CLI 与桌面账号代理派发机械任务。默认使用已在一台 Windows 机器验证的 `deepseek-v4.1-flash`，其他模型先用 doctor 核对。不改父任务模型、WorkBuddy 全局设置或账号凭据。

## 入口

```powershell
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" doctor
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" submit task.json stable-job-id
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" status stable-job-id
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" result stable-job-id
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" cancel stable-job-id
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" list
```

也可在安装目录直接运行 `node scripts/workbuddy_worker.cjs`，不依赖某个项目。

任务文件为 UTF-8 JSON：

```json
{
  "cwd": ".",
  "task": "按给定CSV逐年汇总笔数，返回JSON；保留缺失，不推断策略有效性",
  "files": ["research_outputs/example/trades.csv"],
  "model": "deepseek-v4.1-flash",
  "timeout_seconds": 180
}
```

1. 指定输入和可核对的验收标准。只发送用户允许交给 WorkBuddy 的资料，不发送凭据、客户数据或生产配置。文件必须位于 cwd 内并逐项列出，不支持目录通配符。
2. submit 返回ID后继续独立工作，隔十几秒或更久检查一次。同ID及同输入复用原任务；不同输入报冲突，不重复消费。
3. 只有 state=completed 且结果哈希存在才算已返回。父任务独立核对内容；模型说测试通过不等于实际测试。
4. 退出码0不证明成功。failed、uncertain、超时和取消后不自动换ID重提；先核对状态。取消不能证明供应商没有消费。
5. 默认没有模型工具访问，父任务将指定UTF-8文件文本装入请求。需要改代码时让它返回 unified diff，父任务审核、应用和验证。不得执行未经检查的模型代码。

## 产物与限制

- 任务保存在 `~/.codex/workbuddy-jobs/<id>/`，包括状态、输入哈希和 result.txt/result.json。与桌面聊天历史分开，不保证出现在 WorkBuddy 侧栏。
- 输入总量上限240KiB，单任务上限900秒。宿主内部请求仍受自身超时和大小限制，大任务拆成小批次。
- 桌面须保持登录、运行。代理不可用时明确失败，不切其他账号，不读取登录数据库或导出账号token。
- CLI仍可能宣告内置工具；转发器剥离工具定义和工具提示词，拒绝工具响应。因此是受控纯文本worker，不是任意桌面操作agent。
- 调用消耗原 WorkBuddy 账号额度；usage是上游报告，不是已核实人民币费用。缺失的实际响应模型保持null。
- 内部WBIPC接口不保证升级稳定。来源、检查和接手说明见 [references/transport.md](references/transport.md)。
