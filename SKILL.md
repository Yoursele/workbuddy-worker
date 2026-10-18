---
name: workbuddy-worker
description: Delegate bounded text, code-review, CSV extraction and document-drafting tasks to installed Windows WorkBuddy in the background, then query status, retrieve artifacts or cancel owned jobs. Does not control its GUI or grant production/file-edit access.
---

# WorkBuddy 后台协作

通过本机 WorkBuddy CLI 与桌面账号代理派发机械任务。默认使用已在一台 Windows 机器验证的 `deepseek-v4.1-flash`，其他模型先用 doctor 核对。不改父任务模型、WorkBuddy 全局设置或账号凭据。

## 入口

```powershell
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" doctor
node "$HOME/.codex/skills/workbuddy-worker/scripts/workbuddy_worker.cjs" check task.json
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
- 单任务完整提示词采用24KiB保守输入预算，输出默认1024 token（可设64—8192），时间上限900秒。先用check检查，不通过则显式拆分，不自动截断。此预算不保证宿主所有版本都不超限，也不是金额上限。
- 自动检测本机安装并连接；桌面未运行时尝试后台启动，最多等待25秒（不超过任务总预算），已运行则直接复用。首次安装初始化、登录或桌面授权仍需用户完成。代理不可用时明确失败，不切其他账号，不读取登录数据库或导出账号token。
- CLI仍可能宣告内置工具；转发器剥离工具定义和工具提示词，拒绝工具响应。因此是受控纯文本worker，不是任意桌面操作agent。
- 调用消耗原 WorkBuddy 账号额度；usage是上游报告，不是已核实人民币费用。缺失的实际响应模型保持null。
- 内部WBIPC接口不保证升级稳定。来源、检查和接手说明见 [references/transport.md](references/transport.md)。

- 自动启动使用隐藏进程选项，仍可能因宿主版本或首次登录出现窗口；已运行的应用不关闭或重启。细节见transport说明。

## 指定行与提交前检查

files也可填写`{"path":"scripts/example.py","start_line":10,"end_line":45}`，采用1起算闭区间，只发送选中行，并保留选中内容及源文件哈希。支持从最大2MiB文本中取小片段；秘密路径仍拒绝。先运行check，不创建任务、不启动宿主、不调用模型。出现TASK_NEEDS_SPLIT时缩小明确输入；不自动换ID重发失败或提交不明任务。max_output_tokens可设定输出预算。升级后旧ID若输入契约不同会报冲突，应查询原任务，不能借升级重发。

本轮非流式宿主调用返回HTTP400，已撤回，仍沿用宿主支持的SSE。默认1024 token是请求预算，不证明供应商硬限制；超限根因尚未完全确认。可用小任务已实测，复杂任务应显式拆分。
