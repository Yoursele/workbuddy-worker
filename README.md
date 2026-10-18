# WorkBuddy Worker

让 Codex 把边界明确的机械任务交给 **Windows WorkBuddy 后台处理**，随后查询状态、取回结果并独立复核。

**0.1.0 / Windows 实验性版本 / MIT / 零运行时第三方依赖**

## 能做什么

- 隐藏后台提交，查看状态、结果及输入指纹
- 相同任务ID去重，不同内容同ID拒绝
- 取消自有任务；超时或提交不明保留 `uncertain`，不自动重放
- CSV提取、资料整理、文档草稿和代码补丁草案

这是**受控纯文本worker**。文件必须由父任务逐项指定，模型没有 Shell、文件、MCP 或桌面操作工具。代码修改以补丁返回，由父任务审核和应用。不会创建聊天窗口，不保证显示在 WorkBuddy 桌面侧栏。

## 环境

- Windows 10/11，标准用户目录安装的 WorkBuddy 桌面端
- 桌面已登录并保持运行，内置 `codebuddy-lite-wb.mjs` 与托管Node可用
- Node.js 22+ 用于控制器和离线测试
- 当前只在一台 Windows 安装上实测，其他版本需先运行 doctor

调用使用**原 WorkBuddy 账号额度**，不是免费API。运行器不复制供应商密钥，不切到独立CodeBuddy账号，不改全局模型、Hook或生产配置。

## 安装到 Codex

在 PowerShell 下载仓库后：

```powershell
git clone https://github.com/Yoursele/workbuddy-worker.git
cd workbuddy-worker
node scripts/install.cjs
```

安装器只复制到 `$CODEX_HOME/skills/workbuddy-worker`（未设置时为 `~/.codex/skills/workbuddy-worker`）。已有不同内容时拒绝覆盖。没有自动执行模型调用，也不修改Codex配置。

也可以让 Agent Skills 安装器发现仓库根目录的 `SKILL.md`，或手动复制 Skill 所需文件。安装后可重新打开 Codex 会话以发现 `$workbuddy-worker`。

## 快速使用

先检查原账号代理与模型目录，不调用模型：

```powershell
node scripts/workbuddy_worker.cjs doctor
```

在仓库根目录运行合成例子（这一步会使用WorkBuddy额度）：

```powershell
node scripts/workbuddy_worker.cjs submit examples/task.json example-001
node scripts/workbuddy_worker.cjs status example-001
node scripts/workbuddy_worker.cjs result example-001
```

任务JSON：

```json
{
  "cwd": ".",
  "task": "按年份汇总CSV，保留缺失，返回JSON",
  "files": ["examples/example.csv"],
  "model": "deepseek-v4.1-flash",
  "timeout_seconds": 180
}
```

`cwd` 相对启动命令的当前目录；`files` 相对 cwd。不要提交凭据、客户数据或未经授权的私人源码。模型ID以当前账号 doctor 的结果为准；默认ID不保证其他账号可用，也不代表某个日期后缀版本。

## 状态与控制

```powershell
node scripts/workbuddy_worker.cjs list
node scripts/workbuddy_worker.cjs cancel example-001
```

`queued → starting → running → completed / failed / uncertain`

只有 `completed` 且产物存在才算结果已返回，仍需独立核对正确性。退出码0不代表模型成功。取消或超时不代表供应商未消费，不自动换ID重试。

任务存于 `$CODEX_HOME/workbuddy-jobs/<id>/`，包含明确提供的输入及结果；不上传GitHub。CLI临时工作目录在进程结束后清理。记录不加密，按本地敏感文件管理；不要将任务目录放到公开仓库或共享网盘。

## 验证与限制

```powershell
npm test
npm run check
npm run verify:vendor
npm run package:skill
```

已做真实标记、算术和合成CSV汇总验证，以及本地超时/取消替身检查。范围见 [docs/VALIDATION.md](docs/VALIDATION.md)。不宣称所有模型、长期并发、断电恢复或未来版本兼容性已验证。

内部WBIPC不是官方稳定API。宿主有独立请求时限和大小上限；大任务拆小。默认输入上限240KiB、单任务最多900秒。不要将该工具用于自动交易、资金更新或无需复核的生产操作。

## 来源与许可

复用 Workbuddian 的 MIT 宿主代理和模型目录模块，未分发 WorkBuddy 自身软件。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[LICENSE](LICENSE) 和 [scripts/vendor/LICENSE](scripts/vendor/LICENSE)。
