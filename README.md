# SSH Client

一个基于 Electron + React + TypeScript 构建的 macOS 桌面 SSH 客户端，支持多标签终端、AI 命令生成、文件管理、端口转发和实时系统监控。

---

## 功能特性

### 🔌 SSH 连接
- 密码 / 私钥认证
- **跳板机（堡垒机）**支持 — 通过中间主机 SSH 隧道连接目标
- 多标签终端，同时连接多台服务器
- 终端自适应窗口大小，支持 resize 同步到远程 pty
- **Alternate Screen 检测** — 在 vi/less/top 等 TUI 程序中自动禁用 AI 拦截

### 🤖 AI 命令助手
- 终端内输入中文或以 `?` 开头，自动触发 AI 命令生成
- 支持 **OpenAI / DeepSeek / 通义千问 / Kimi / 智谱 / Ollama / 自定义 API**
- AI 面板（右侧滑出对话界面）— 命令解释 + 一键执行/复制
- 自动收集远程系统信息（OS、内核版本、用户），注入 AI 上下文

### 📁 远程文件管理
- 文件浏览、上传、下载、删除、重命名、新建文件夹
- 传输进度条实时显示
- **SFTP / Exec 双模式**：未安装 SFTP 服务的嵌入式系统自动回退到 shell 命令模式
- 右键上下文菜单

### 📊 实时系统监控
- SVG 环形仪表盘 — CPU / 内存 / 磁盘使用率
- 绿 → 橙 → 红 颜色渐变告警
- 网络上下行实时速率
- 可折叠半透明浮动面板

### 🔀 端口转发
- 本地端口 → 远程主机:端口 的 SSH 隧道
- 独立的隧道管理视图
- 状态实时显示

### 🎨 UI 特性
- **6 套配色主题** — 深色 / Monokai / Dracula / Nord / Solarized Dark / 浅色
- 侧边栏可拖拽调整宽度
- 连接分组管理（拖拽排序、拖拽分组）
- 标签页拖拽排序
- **标签页分屏** — 拖拽标签到另一标签（左/右=垂直，上/下=水平），支持拖动分隔条调整比例
- 右键上下文菜单（克隆会话 / 分屏 / 断开 / 重连）
- macOS 原生 `hiddenInset` 标题栏

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 31 |
| 前端 | React 18 + TypeScript 5.5 |
| 构建 | electron-vite 2.3 + Vite 5 |
| 终端 | xterm.js 5.5 |
| SSH | ssh2 1.17 |
| 打包 | electron-builder 24.13 |
| 平台 | macOS (Apple Silicon / Intel) |

---

## 项目结构

```
ssh-client/
├── electron.vite.config.ts       # Vite 三目标构建配置
├── package.json                  # 依赖 & 打包配置
├── tsconfig.json                 # 根 TS 配置
├── tsconfig.node.json            # Node 端 TS 配置
├── tsconfig.web.json             # 浏览器端 TS 配置
├── tsconfig.test.json            # 测试端 TS 配置
├── vitest.config.ts              # Vitest 测试配置
├── README.md                     # 本文档
├── PROJECT_DOCUMENTATION.md      # 详细架构与技术文档
├── src/
│   ├── main/                     # 主进程
│   │   ├── index.ts              # Electron 入口 + IPC 注册
│   │   ├── ssh.ts                # SSH 连接核心（ssh2 封装）
│   │   ├── sftp.ts               # SFTP 文件管理
│   │   ├── ai.ts                 # AI 命令生成器
│   │   ├── monitor.ts            # 远程系统监控
│   │   └── store.ts              # 数据持久化（JSON）
│   ├── preload/
│   │   └── index.ts              # contextBridge IPC 桥接
│   └── renderer/
│       ├── index.html            # HTML 入口
│       └── src/
│           ├── main.tsx          # React 入口
│           ├── App.tsx           # 根组件（状态管理 + 布局）
│           ├── types.ts          # TypeScript 类型定义
│           ├── themes.ts         # 6 套主题配色
│           ├── styles.css        # 全局样式
│           └── components/
│               ├── Terminal.tsx           # 终端组件（含 AI 拦截）
│               ├── SplitTerminal.tsx      # 分屏终端（左右/上下分屏）
│               ├── ConnectionDialog.tsx   # 连接对话框
│               ├── TabBar.tsx             # 标签栏（拖拽排序/分屏）
│               ├── FileManager.tsx        # 文件管理器
│               ├── AIPanel.tsx            # AI 助手面板
│               ├── MonitorOverlay.tsx     # 系统监控浮层
│               ├── PortForwardView.tsx    # 端口转发管理
│               ├── PortForwardPanel.tsx   # 端口转发面板（遗留）
│               └── SettingsDialog.tsx     # 设置对话框
├── tests/                        # 单元/组件测试
│   ├── setup.ts                  # 测试环境初始化
│   ├── components/               # 组件测试（TabBar）
│   └── unit/                     # 单元测试（ai / monitor）
├── out/                          # 编译产物
└── dist/                         # 打包产物（DMG）
```

---

## 开发指南

### 环境要求

- **Node.js** >= 18（推荐 20 LTS）
- **npm** >= 9
- **macOS**（项目使用 `hiddenInset` 标题栏，macOS 专有）

### 安装依赖

```bash
cd ssh-client
npm install
```

### 启动开发模式

```bash
npm run dev
```

启动 Electron 窗口，支持热重载。渲染进程修改即时生效，主进程修改自动重启。

### 编译

```bash
npm run build
```

产物在 `out/` 目录：
- `out/main/index.js` — 主进程
- `out/preload/index.js` — Preload 脚本
- `out/renderer/` — 渲染进程（HTML + JS + CSS）

### 打包 macOS 安装包

```bash
npm run dist
```

产物在 `dist/` 目录：
- `SSH Client-1.0.0-arm64.dmg` — macOS DMG 安装包
- `SSH Client-1.0.0-arm64.dmg.blockmap` — 增量更新校验文件

> **注意**：打包时不进行代码签名。如需签名，请在 macOS 钥匙串中配置 "Developer ID Application" 证书，electron-builder 会自动检测并使用。

### 自动化打包脚本

一键完成 编译 → 打包 .app → 签名 → 安装 → 打开：

```bash
./pack.sh
```

脚本内容见 `pack.sh`，等价于以下手动步骤：

```bash
# 1. 编译 + 打包 .app
npm run build && npx electron-builder --mac --dir

# 2. ad-hoc 临时签名（无 Developer ID 证书时使用）
codesign --force --deep --sign - "dist/mac-arm64/SSH Client.app"

# 3. 安装到 /Applications 并清除 Gatekeeper 隔离属性
rm -rf "/Applications/SSH Client.app"
cp -R "dist/mac-arm64/SSH Client.app" /Applications/
xattr -dr com.apple.quarantine "/Applications/SSH Client.app"
```

> **无证书签名的问题**：未签名（或仅 ad-hoc 签名）的 .app 会被 macOS Gatekeeper 判定为恶意软件并拦截，报"已阻止恶意软件"。本地开发可用 `codesign --force --deep --sign -` 临时签名解决。**若要分发他人**，需要：
> 1. Apple Developer 账号，申请 "Developer ID Application" 证书
> 2. 配置签名：`CSC_LINK` / `CSC_KEY_PASSWORD` 环境变量，electron-builder 自动签名
> 3. 公证（notarize）：`npx electron-builder --mac --config.mac.notarize=true` 或 electron-builder 24+ 配置 `mac.notarize`
> 4. 公证后需 `xcodebuild -exportArchive` 或用 `ditto` 重新签名/加时间戳，确保用户无弹窗安装

### 测试

```bash
npm test              # 运行全部测试（vitest run）
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率报告
```

测试覆盖 `src/main/ai.ts`、`src/main/monitor.ts` 及 `TabBar` 组件，配置见 `vitest.config.ts` 与 `tests/`。

> 更详细的架构设计、IPC 协议与数据流说明，参见 [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)。

### 调试

SSH 连接调试日志写入系统临时目录：
```
$TMPDIR/ssh-client-debug.log
```

---

## 配置说明

### AI 助手配置

在 **设置** 对话框中选择 AI 服务商：

| 服务商 | API 地址 | 默认模型 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode` | `qwen-plus` |
| Kimi | `https://api.moonshot.cn` | `moonshot-v1-8k` |
| 智谱 | `https://open.bigmodel.cn/api/paas` | `glm-4-flash` |
| Ollama | `http://localhost:11434` | `llama3` |
| 自定义 | 用户自定义 | 用户自定义 |

配置保存于 `~/Library/Application Support/ssh-client/settings.json`。

### 连接存储

连接配置保存于 `~/Library/Application Support/ssh-client/connections.json`，支持分组管理。

---

## 常见问题

### Q: 文件管理器提示 "远端未安装 SFTP 服务"
这是正常提示，程序会自动回退到 shell 命令模式（`ls -la` / `cat`），功能不受影响。常见于 BusyBox / Alpine / 精简嵌入式系统。

### Q: 终端中文/Emoji 显示异常
已加载 Unicode 字素簇和 Unicode 11 宽度支持。如仍有问题，确保远程系统的 `LANG` 环境变量设置为 `en_US.UTF-8` 或 `zh_CN.UTF-8`。

### Q: 编译时权限错误
某些情况下 `node_modules/.bin` 下的文件权限可能不正确，运行以下命令修复：

```bash
chmod -R +x node_modules/.bin/
find node_modules -type f \( -name "*.node" -o -path "*/bin/*" \) -exec chmod +x {} \;
```

### Q: 如何构建 Intel Mac 版本
修改 `electron-builder` 配置，添加 `--x64` 参数：
```bash
npx electron-builder --mac --x64
```

---

## 依赖说明

### 核心运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| ssh2 | ^1.17.0 | SSH2 协议客户端 |
| @xterm/xterm | ^5.5.0 | Web 终端模拟器 |
| @xterm/addon-fit | ^0.10.0 | 终端自适应容器 |
| @xterm/addon-unicode-graphemes | ^0.4.0 | 字素簇支持 |
| @xterm/addon-unicode11 | ^0.9.0 | Unicode 11 宽度 |
| @xterm/addon-web-links | ^0.11.0 | 终端链接识别 |
| react / react-dom | ^18.3.1 | UI 框架 |

### 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| electron | ^31.0.0 | Electron 框架 |
| electron-vite | ^2.3.0 | Vite 构建集成 |
| electron-builder | ^24.13.3 | DMG 安装包打包 |
| typescript | ^5.5.2 | 类型检查 & 编译 |
| @vitejs/plugin-react | ^4.3.1 | React JSX 编译 |

---

## 许可证

项目使用 SSH Client 自有许可，仅供个人学习和使用。
