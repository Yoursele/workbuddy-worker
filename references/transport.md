# 通路与接手说明

## 开源复用

`ywu73/codex-workbuddy-subagent` 为MIT，但固定macOS启动路径且要求本会话未提供的原生agent类型，未直接安装其Hook。`ZhaoXiangyu99/workbuddy-mcp` 为剪贴板交接，不满足自动回收。

复用 `https://github.com/jiang198012/workbuddian` 的MIT `workbuddyBroker.ts`、`workbuddyModels.ts`。固定提交和文件哈希在 scripts/vendor/SOURCE.json，原许可保留为 LICENSE。两个TS编译为自包含workbuddy.cjs，仅用Node标准库，运行无需安装依赖。复用层负责WBIPC挑战应答和账号模型目录，供应商凭据始终留在宿主。

## 本机差异

真实入口为安装目录 cli/dist/codebuddy-lite-wb.mjs，由WorkBuddy自带Node启动；bin/codebuddy默认寻找缺失的full/headless bundle。

直接运行会出现Authentication required，桌面已登录不能证明独立CLI已认证。控制器通过宿主代理，并创建仅绑定127.0.0.1、校验随机进程内认证值的单任务推理转发器。仅允许文本推理路径；配置、账号、充值、上传请求拒绝。不改安装包，不展示或持久化宿主认证材料。

模型消息替换为明确的任务与输入，工具定义全部移除，工具响应拒绝交付。产物只作文本保存，补丁由父任务应用。

## 状态与恢复

queued → starting → running → completed/failed/uncertain。同ID不重放，run.claim只能首次创建。取消、超时在已提交时为uncertain，不推断未计费。只能停止自己创建的CLI，不结束桌面任务。

status可检测监督进程消失。PID复用、断电以及应用升级恢复尚未提供严格恢复协议，不适合自动交易/资金操作，也不自动重启孤儿任务。

## 验证

`node scripts/selftest.cjs` 为离线测试。发布验收摘要见仓库 docs/VALIDATION.md；用户任务与本机运行记录不随仓库发布。离线检查不能证明所有模型、长期并发和升级兼容性。


## 自动启动（0.1.1）

doctor与任务执行都会先连接现有本地代理；代理未就绪时检查WorkBuddy进程，未运行则以隐藏进程选项及`--start-minimized`启动安装目录中的WorkBuddy.exe，有限等待代理就绪。无需预先手动打开窗口。首次登录/授权和模型目录可用性仍由宿主处理，不读取登录数据库、不导出凭据。Windows隐藏选项不能保证所有WorkBuddy版本永不弹窗；已运行的应用不会被关闭或重启。安装位置仍限于当前支持的用户级安装路径。启动等待不发送模型消息，也不会重试不确定任务。
