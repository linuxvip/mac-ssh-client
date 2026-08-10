# SSH Client — 项目文档

## 1. 项目概览

**项目名称**: SSH Client  
**版本**: 1.0.0  
**类型**: 基于 Electron 的桌面 SSH 客户端  
**平台**: macOS (macOS 专有，使用 `hiddenInset` 标题栏风格)  
**技术栈**: Electron 31 + React 18 + TypeScript 5.5 + Vite 5  
**描述**: 一款面向运维和开发者的 macOS 原生 SSH 客户端，支持多标签终端、文件管理、端口转发、AI 命令助手和实时系统监控。

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 主进程                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ index.ts │ │  ssh.ts  │ │ sftp.ts  │ │  ai.ts   │   │
│  │  (入口)  │ │(SSH核心) │ │(文件传输)│ │(AI助手) │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐                              │
│  │monitor.ts│ │ store.ts │                              │
│  │(系统监控)│ │(持久化)  │                              │
│  └──────────┘ └──────────┘                              │
├─────────────────────────────────────────────────────────┤
│                  IPC 通信层 (Preload)                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │           preload/index.ts                        │   │
│  │  暴露 api 对象到渲染进程 (contextBridge)          │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│              Electron 渲染进程 (React 18)               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │   App.tsx    │ │  Terminal    │ │ Connection   │    │
│  │   (根组件)   │ │  (终端组件)  │ │ Dialog       │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  TabBar      │ │ FileManager  │ │  AIPanel     │    │
│  │  (标签栏)    │ │ (文件管理)   │ │ (AI面板)     │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ PortForward  │ │MonitorOverlay│ │  Settings    │    │
│  │ View         │ │ (系统监控)   │ │  Dialog      │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 构建系统

- **electron-vite**: 统一管理三个构建目标：
  - `main` — Electron 主进程（Node.js 环境）
  - `preload` — Preload 脚本（受限 Node.js 环境）
  - `renderer` — React 渲染进程（浏览器环境）
- **electron-builder**: 打包 macOS DMG 安装包
- **TypeScript**: 3 个 tsconfig 分别对应三个构建目标

### 2.3 目录结构

```
ssh-client/
├── electron.vite.config.ts    # Vite 构建配置（三目标）
├── package.json               # 依赖 & 打包配置
├── tsconfig.json              # 根 TS 配置（引用两个子配置）
├── tsconfig.node.json         # Node 端 TS 配置（main + preload）
├── tsconfig.web.json          # 浏览器端 TS 配置（renderer）
├── src/
│   ├── main/                  # 🔵 主进程代码
│   │   ├── index.ts           # Electron 入口 + IPC 处理器注册
│   │   ├── ssh.ts             # SSH 连接核心（ssh2 库封装）
│   │   ├── sftp.ts            # SFTP 文件管理（含 exec 回退方案）
│   │   ├── ai.ts              # AI 命令生成器（调用 LLM API）
│   │   ├── monitor.ts         # 远程系统资源监控
│   │   └── store.ts           # 本地数据持久化（JSON 文件）
│   ├── preload/               # 🟡 Preload 桥接层
│   │   └── index.ts           # contextBridge 暴露 IPC API
│   └── renderer/              # 🟢 渲染进程
│       ├── index.html         # HTML 入口
│       └── src/
│           ├── main.tsx       # React 入口
│           ├── App.tsx        # 根组件（状态管理 + 布局）
│           ├── types.ts       # TypeScript 类型定义
│           ├── themes.ts      # 主题系统（6 套配色方案）
│           ├── styles.css     # 全局样式表
│           └── components/
│               ├── Terminal.tsx           # xterm.js 终端组件
│               ├── ConnectionDialog.tsx   # 新建/编辑连接对话框
│               ├── TabBar.tsx             # 标签栏（拖拽排序）
│               ├── FileManager.tsx        # 远程文件管理器
│               ├── AIPanel.tsx            # AI 助手面板
│               ├── MonitorOverlay.tsx     # 系统资源监控浮层
│               ├── PortForwardView.tsx    # 端口转发管理
│               ├── PortForwardPanel.tsx   # 端口转发表单
│               └── SettingsDialog.tsx     # 设置对话框
├── out/                       # 构建输出
│   ├── main/index.js
│   ├── preload/index.js
│   └── renderer/index.html
└── dist/                      # 打包产物（DMG 安装包）
```

---

## 3. 核心模块详解

### 3.1 主进程入口 (`src/main/index.ts`)

**职责**: Electron 应用生命周期管理、窗口创建、IPC 处理器注册、应用菜单设置。

**关键实现**:
- 创建 `BrowserWindow`，尺寸 1200×800，最小 800×600
- 使用 `titleBarStyle: 'hiddenInset'` 实现 macOS 原生标题栏嵌入效果
- 设置中文菜单栏（SSH 客户端 / 编辑）
- 注册 18 个 IPC handler，分类如下：

| 分类 | Handler | 方向 |
|------|---------|------|
| 连接存储 | `connections:load`, `connections:save` | renderer ↔ main |
| 设置存储 | `settings:load`, `settings:save` | renderer ↔ main |
| SSH | `ssh:connect`, `ssh:disconnect`, `ssh:data`, `ssh:resize` | renderer ↔ main |
| 端口转发 | `port-forward:start`, `port-forward:stop` | renderer ↔ main |
| SFTP | `sftp:home`, `sftp:list`, `sftp:download`, `sftp:upload`, `sftp:delete`, `sftp:mkdir`, `sftp:rename` | renderer ↔ main |
| AI | `ai:process`, `ai:system-info`, `ai:clear-cache` | renderer ↔ main |
| 监控 | `monitor:start`, `monitor:stop` | renderer ↔ main |

### 3.2 SSH 核心 (`src/main/ssh.ts`)

**职责**: 封装 `ssh2` 库，提供 SSH 连接管理、数据转发、端口转发和命令执行。

**核心类型**:
- `SSHConfig` — 连接配置（主机、端口、用户名、密码/密钥、跳板机）
- `ForwardConfig` — 端口转发配置
- `Session` — 活跃会话（Client + Stream）

**关键功能**:

1. **直接连接** (`createSSHConnection`)
   - 使用 `ssh2.Client` 建立 SSH 连接
   - 配置 `xterm-256color` 终端类型
   - 通过 `StringDecoder` 处理 UTF-8 编码
   - 将终端输出通过 IPC event 推送到渲染进程

2. **跳板机连接** (Jump Host / Bastion)
   - 三步连接流程：
     1. 先连接到跳板机 (`jumpClient`)
     2. 通过 `jumpClient.forwardOut()` 创建到目标主机的 TCP 隧道
     3. 在隧道上再建立一个 `ssh2.Client` 连接到目标主机
   - 支持跳板机独立认证（不同用户名/密码/密钥）

3. **端口转发** (`forwardPort`)
   - 使用 `net.createServer` 创建本地 TCP 服务器
   - 通过 SSH 隧道将本地端口流量转发到远程主机端口
   - 双向 pipe 数据流

4. **命令执行** (`execCommand`)
   - 向远程主机执行 shell 命令并返回标准输出
   - 被 AI 和 Monitor 模块复用

5. **调试日志**
   - 所有关键操作写入 `$TMPDIR/ssh-client-debug.log`
   - 包含时间戳、连接状态、错误信息

### 3.3 SFTP 文件管理 (`src/main/sftp.ts`)

**职责**: 提供远程文件浏览、上传、下载、删除、重命名等操作。

**设计亮点 — SFTP/Exec 双模式**:
- 优先尝试 SFTP 子系统
- 如果远端未安装 SFTP 服务（常见于 BusyBox/嵌入式系统），自动回退到 `exec` 模式
- Exec 模式通过 `ls -la`、`cat`、`mkdir` 等命令实现同等功能

**文件列表解析** (`execList`):
- 兼容多种 `ls -la` 输出格式（GNU、BusyBox、macOS）
- 智能检测日期列定位文件名
- 处理符号链接（`->` 箭头解析）
- 目录优先排序，同类型按名称字母排序

**文件传输进度**:
- 通过 `IpcMainInvokeEvent.sender.send('sftp:progress', ...)` 实时推送进度
- SFTP 模式可获取精确文件大小，Exec 模式无法获取总大小（显示为 -1）

**下载流程**:
- SFTP: `sftp.createReadStream()` → 本地 `fs.createWriteStream()`
- Exec: `cat <remotePath>` → 本地写文件
- 使用系统原生的保存对话框 (`dialog.showSaveDialog`)

**上传流程**:
- 支持多文件同时选择 (`multiSelections`)
- SFTP: 本地 `fs.createReadStream()` → `sftp.createWriteStream()`
- Exec: `cat > <remotePath>` 管道传输

### 3.4 AI 助手 (`src/main/ai.ts`)

**职责**: 将自然语言描述转换为 Linux shell 命令，通过调用 LLM API 实现。

**支持的 AI 服务商**:

| 服务商 | API 地址 | 默认模型 |
|--------|----------|----------|
| OpenAI | `api.openai.com` | `gpt-4o` |
| DeepSeek | `api.deepseek.com` | `deepseek-chat` |
| 通义千问 | `dashscope.aliyuncs.com` | `qwen-plus` |
| Kimi | `api.moonshot.cn` | `moonshot-v1-8k` |
| 智谱 | `open.bigmodel.cn` | `glm-4-flash` |
| Ollama | `localhost:11434` | `llama3` |
| 自定义 | 用户自定义 | 用户自定义 |

**核心流程** (`classifyAndProcess`):

1. **系统信息收集**: 执行 `uname -a`、`cat /etc/os-release`、`whoami`，结果缓存到 `systemInfoCache`
2. **Prompt 构建**: 将系统信息注入 system prompt，告知 AI 当前主机环境
3. **Few-shot 示例**: 提供 4 组输入/输出示例，引导 AI 输出结构化 JSON
4. **API 调用**: 兼容 OpenAI 风格的 `/v1/chat/completions` 端点
5. **JSON 提取**: 处理 markdown 代码块包裹的情况，支持重试机制

**输出分类**:
- `command` — 用户输入本身就是 shell 命令，直接返回
- `ai` — 根据自然语言描述生成的命令（含解释说明）
- `error` — 无法通过命令完成的请求

### 3.5 系统监控 (`src/main/monitor.ts`)

**职责**: 通过 SSH 执行远程命令，实时采集 CPU、内存、磁盘、网络数据。

**采集命令** (单次 SSH exec 批量采集):
```bash
head -1 /proc/stat        # CPU 统计
cat /proc/meminfo | head -3 # 内存信息（MemTotal, MemFree, MemAvailable）
df -B1 / | tail -1        # 磁盘使用
cat /proc/net/dev          # 网络接口统计
date +%s%N                 # 远程时间戳（纳秒精度）
```

**数据解析**:
- **CPU**: 通过 `/proc/stat` 的两次采样差值计算使用率（`(total - idle) / total`）
- **内存**: 优先使用 `MemAvailable` 计算 `used = total - available`（比 `total - free` 更准确）
- **磁盘**: 解析 `df -B1` 的字节精确输出
- **网络**: 通过两次采样的字节差除以时间差计算实时速率（排除 loopback 接口），使用远程时间戳确保 dt 精度

**采集周期**: 每 2 秒轮询一次

**数据格式** (`MonitorData`):
```typescript
{
  cpu: number          // CPU 使用率百分比
  mem: { used, total, percent }
  disk: { used, total, percent }
  net: { rx, tx }     // 网络速率 (bytes/s)
}
```

### 3.6 数据持久化 (`src/main/store.ts`)

**职责**: 将连接配置和用户设置持久化到本地 JSON 文件。

**存储路径**:
- 连接: `{userData}/connections.json`
- 设置: `{userData}/settings.json`

**数据格式**:
- 连接数据支持新旧两种格式自动迁移：旧格式为纯数组，新格式为 `{ connections, groups }`
- 设置数据为通用 `Record<string, unknown>`，灵活扩展

---

## 4. Preload 桥接层 (`src/preload/index.ts`)

**职责**: 通过 `contextBridge.exposeInMainWorld` 安全地向渲染进程暴露 IPC 通信接口。

**API 对象结构**:
```
window.api
├── ssh: { connect, disconnect, send, resize, onOutput, onClosed }
├── portForward: { start, stop, onActive }
├── connections: { load, save }
├── settings: { load, save }
├── sftp: { home, list, download, upload, delete, mkdir, rename, onProgress }
├── ai: { process, getSystemInfo, clearCache }
└── monitor: { start, stop, onData }
```

---

## 5. 渲染进程 (React UI)

### 5.1 根组件 (`App.tsx`)

**职责**: 全局状态管理中心，管理标签页、连接列表、分组、侧边栏、AI 状态。

**状态变量** (20+):
- `tabs` / `activeTabId` — 终端标签管理
- `savedConnections` / `groups` — 连接簿管理
- `sidebarTab` — 侧边栏选项卡切换（连接管理 / 端口转发）
- `fileManagerTabId` — 文件管理器会话
- `showAIPanel` / `aiEnabled` / `aiOn` — AI 面板控制
- `currentTheme` — 当前主题
- 多种拖拽状态（分组拖拽、连接拖拽排序）

**布局结构**:
```
┌──────────┬──────────────────────────────────────┐
│  Sidebar │  TabBar (标签栏)                      │
│  (侧边栏)│  ┌──────────────────────────────────┐ │
│          │  │  Terminal (xterm.js)             │ │
│ 连接列表  │  │                                  │ │
│ 分组管理  │  │  MonitorOverlay (浮动监控面板)   │ │
│          │  │                                  │ │
│ 端口转发  │  └──────────────────────────────────┘ │
│          │  Toolbar (文件管理 / AI 助手按钮)     │
│  设置    │                                       │
│  AI开关  │                                       │
└──────────┴──────────────────────────────────────┘
```

**侧边栏功能**:
- 可拖拽调整宽度 (160px - 400px)
- 支持连接分组（创建、重命名、删除、折叠展开）
- 连接项支持拖拽到不同分组或排序
- 右键上下文菜单（连接、编辑、删除）

### 5.2 终端组件 (`Terminal.tsx`)

**职责**: 基于 xterm.js 的完整终端模拟器。

**关键特性**:
- **xterm.js addons**: FitAddon（自适应大小）、Unicode11Addon / UnicodeGraphemesAddon（Emoji/宽字符支持）
- **终端主题**: 自动跟随 CSS 变量（`--term-bg`, `--term-fg`, `--term-cursor`）
- **SSH 生命周期**: 组件挂载时自动连接，卸载时自动断开
- **窗口 resize 同步**: 终端大小变化通过 `ssh:resize` 同步到远程 SSH 会话的 pty
- **Debounced resync**: 150ms 防抖 resize，确保远程 TUI 程序（如 vi、top）正确重绘
- **Alternate screen 检测**: 当远程程序进入 alternate screen（如 vi、less），自动禁用 AI 拦截

**AI 内联模式** (在终端中直接使用 AI):
- **触发条件**: 行首输入中文字符或以 `?` 开头
- **机制**: 本地 echo（青色字体），Enter 后发送到 AI 处理
- **确认流程**: AI 返回命令后，显示绿色命令预览 + `[Enter 执行 | Esc 取消]` 提示
- **锁定保护**: AI 加载中 / 有待确认命令 / 在 TUI 模式下均阻止输入
- **Unicode 退格**: 正确处理中文/全角字符的 2 列宽度回退

### 5.3 连接对话框 (`ConnectionDialog.tsx`)

**功能**:
- 新建/编辑 SSH 连接
- 连接名称、主机、端口、用户名、密码（可切换显示/隐藏）、私钥路径
- 可选跳板机配置（地址、端口、用户名、密码）
- 三个操作按钮：取消、保存（仅保存不连接）、连接（保存并连接）

### 5.4 文件管理器 (`FileManager.tsx`)

**功能**:
- 远程文件浏览（表格视图: 名称、大小、修改时间）
- 路径导航（上级目录按钮、路径输入框、回车跳转）
- 文件操作：上传、下载、删除、新建文件夹、重命名
- 右键上下文菜单
- 传输进度条显示
- 文件夹用 📁 图标、文件用 📄 图标区分
- 自动从用户 Home 目录开始浏览

### 5.5 AI 面板 (`AIPanel.tsx`)

**功能**:
- 右侧滑出面板（380px 宽），带滑入动画
- 对话式界面（用户消息 / AI 回复气泡）
- AI 回复包含：命令解释 + 代码块 + 执行/复制/取消按钮
- 打字动画指示器（三个跳动圆点）
- 支持 Enter 发送，自动滚动到底部

### 5.6 系统监控浮层 (`MonitorOverlay.tsx`)

**功能**:
- 终端右上角的半透明浮动监控面板
- **SVG 环形仪表盘**: CPU、内存、磁盘 三个环形仪表
  - 绿色 (< 60%) → 橙色 (60-85%) → 红色 (> 85%)
  - 颜色发光效果 (drop-shadow)
- **网络速率**: 下行 (绿色箭头) 和上行 (橙色箭头) 实时速率
- 可折叠/展开面板
- 呼吸灯状态指示 (绿色脉冲动画)

### 5.7 端口转发 (`PortForwardView.tsx`)

**功能**:
- 独立的端口转发管理视图（侧边栏第二个选项卡）
- 创建隧道时自动建立 SSH 连接
- 状态指示（连接中/活跃/错误）
- 显示隧道详情：本地端口 → 远程地址:端口，连接来源
- 一键删除（断开 SSH + 停止转发）

### 5.8 设置对话框 (`SettingsDialog.tsx`)

**功能**:
- **主题选择**: 6 套配色方案的卡片式选择器（带预览缩略图）
- **AI 配置**: 服务商选择、API 地址、API Key、模型名称
- 支持即时预览主题效果，取消则回退原主题

### 5.9 主题系统 (`themes.ts`)

**6 套配色方案**:

| 主题名称 | 风格描述 |
|---------|---------|
| 深色 (默认) | VS Code Dark 风格 |
| Monokai | 经典代码编辑器配色 |
| Dracula | 紫色系暗色主题 |
| Nord | 蓝灰色北极风格 |
| Solarized Dark | 经典的暖色暗色方案 |
| 浅色 | 明亮浅色主题 |

**主题变量** (19 个 CSS 自定义属性):
- 基础: `--bg`, `--bg-sidebar`, `--bg-panel`, `--bg-input`, `--bg-hover`
- 文字: `--fg`, `--fg-muted`, `--fg-dim`
- 边框: `--border`, `--border-light`
- 强调: `--accent`, `--accent-hover`
- 终端: `--term-bg`, `--term-fg`, `--term-cursor`
- 状态: `--success`, `--warning`, `--danger`

主题切换通过 `applyTheme()` 函数将所有变量写入 `document.documentElement.style`。

---

## 6. 类型系统 (`src/renderer/src/types.ts`)

```typescript
ConnectionConfig {
  name?, host, port, username, password?, privateKey?
  jumpHost?: { host, port, username, password?, privateKey? }
}

Tab {
  id, title, config: ConnectionConfig
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

ForwardRule {
  id, localPort, remoteHost, remotePort, active: boolean
}
```

---

## 7. 依赖分析

### 7.1 运行时依赖

| 依赖 | 用途 |
|------|------|
| `ssh2` (^1.16.0) | Node.js SSH2 协议实现，核心 SSH 连接库 |
| `@xterm/xterm` (^5.5.0) | 浏览器终端模拟器 |
| `@xterm/addon-fit` | 终端自适应容器大小 |
| `@xterm/addon-unicode-graphemes` | Unicode 字素簇支持（emoji 等） |
| `@xterm/addon-unicode11` | Unicode 11 宽度标准 |
| `@xterm/addon-web-links` | 终端内链接识别和点击 |
| `react` / `react-dom` (^18.3.1) | UI 框架 |
| `@electron-toolkit/preload` / `utils` | Electron 工具函数 |

### 7.2 开发依赖

| 依赖 | 用途 |
|------|------|
| `electron` (^31.0.0) | Electron 框架 |
| `electron-vite` (^2.3.0) | 三目标 Vite 构建 |
| `electron-builder` (^24.13.3) | macOS DMG 打包 |
| `typescript` (^5.5.2) | 类型系统 |
| `@vitejs/plugin-react` | React JSX/TSX 编译 |
| `@types/ssh2` | ssh2 类型定义 |

---

## 8. 打包配置

```json
{
  "appId": "com.ssh-client.app",
  "productName": "SSH Client",
  "mac": {
    "target": "dmg",
    "category": "public.app-category.developer-tools"
  },
  "files": ["out/**/*"]
}
```

- 仅构建 macOS DMG 安装包
- 归类为开发者工具
- 只打包 `out/` 目录下的构建产物

---

## 9. 可用的 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热重载） |
| `npm run build` | 构建（Vite 三目标编译） |
| `npm run preview` | 预览构建结果 |
| `npm run pack` | 构建 + 打包为 macOS 目录格式 |
| `npm run dist` | 构建 + 打包为 macOS DMG 安装包 |

---

## 10. 数据流图

### 10.1 SSH 连接流程

```
用户点击连接 / 双击保存的连接
  → App.handleConnect()
    → 创建 Tab { id, config, status: 'connecting' }
    → 关闭对话框
    → Terminal.useEffect() 挂载
      → new XTerm() + addons
      → window.api.ssh.connect({ ...config, sessionId: tab.id })
        → IPC invoke → main/index.ts
          → createSSHConnection(event, config)
            → new ssh2.Client()
            → client.connect(targetOpts)
            → client.on('ready')
              → client.shell({ term: 'xterm-256color' })
                → stream.on('data') → event.sender.send('ssh:output:...')
                → resolve({ success: true })
      → onStatusChange('connected')
      → 终端开始接收远程输出
```

### 10.2 AI 命令生成流程

```
用户在终端输入中文 / ? 开头的查询
  → term.onData 检测到 AI 触发条件
    → 本地 echo（青色）
    → Enter 后调用 window.api.ai.process(sessionId, query)
      → IPC invoke → main/index.ts
        → ai.classifyAndProcess(sessionId, input, aiConfig)
          → collectSystemInfo(sessionId)
            → execCommand('uname -a') / 'cat /etc/os-release' / 'whoami'
          → 构建 ChatMessage[] (system + examples + user input)
          → chatWithAI(messages, config)
            → fetch(apiUrl/v1/chat/completions, { model, messages })
          → 解析 JSON 响应 → { type, cmd, explain }
      → Terminal 显示结果预览
        → 用户按 Enter → 执行命令 (sendToTerminal)
        → 用户按 Esc → 取消
```

### 10.3 文件管理流程

```
用户点击 "文件管理" 按钮
  → setFileManagerTabId(activeTab.id)
  → FileManager 挂载
    → window.api.sftp.home(sessionId)
      → exec 'echo $HOME' → 获取 home 目录
    → loadDir(homeDir)
      → window.api.sftp.list(sessionId, path)
        → getSFTP(sessionId)
          → 成功: sftp.readdir(path) → 解析文件列表
          → 失败: execList(sessionId, path) → exec 'ls -la' → 解析输出
      → setFiles(list)

用户下载文件:
  → window.api.sftp.download(sessionId, remotePath, fileName)
    → dialog.showSaveDialog() → 选择本地路径
    → getSFTP(sessionId)
      → 成功: sftp.createReadStream() → fs.createWriteStream()
      → 失败: execDownload() → exec 'cat <path>' → fs.createWriteStream()
    → 实时推送 sftp:progress 事件

用户上传文件:
  → window.api.sftp.upload(sessionId, currentPath)
    → dialog.showOpenDialog({ multiSelections: true })
    → 遍历每个文件:
      → SFTP: fs.createReadStream() → sftp.createWriteStream()
      → Exec: fs.createReadStream() → exec 'cat > <path>' pipe
    → 实时推送 sftp:progress 事件
```

---

## 11. 安全性考量

1. **Context Isolation**: 启用了 `contextIsolated: true`，渲染进程通过 `contextBridge` 安全访问受限 API
2. **密码存储**: 密码明文存储在本地 JSON 文件（`connections.json`），未加密 — **安全性需要改进**
3. **API Key 存储**: AI API Key 明文存储在 `settings.json` — **安全性需要改进**
4. **SSH 密钥**: 支持从文件系统读取私钥文件，支持 `~` 路径展开
5. **沙盒**: `sandbox: false`（因为需要 Node.js 集成的 ssh2 库在 preload 中无法完整运行）
6. **跳板机**: 跳板机连接同样使用独立的 SSH 认证

---

## 12. 亮点特性总结

1. **跳板机/堡垒机支持**: 通过 SSH `forwardOut` 实现完整的跳板机隧道连接
2. **AI 内联模式**: 在终端中直接输入自然语言即可生成命令，无需切换界面
3. **SFTP/Exec 双模回退**: 兼容未安装 SFTP 服务的嵌入式/精简系统
4. **实时系统监控**: SVG 环形仪表盘 + 网络速率，GPU 友好的视觉效果
5. **多标签终端**: 支持同时连接多台服务器，标签可拖拽排序
6. **连接分组管理**: 支持分组、拖拽排序、拖拽改变分组
7. **6 套主题**: 即时预览的主题切换系统，CSS 变量驱动
8. **端口转发管理**: 独立的端口转发视图，支持基于已保存连接快速创建隧道
9. **Unicode 宽字符**: 正确处理中文、emoji 等宽字符的终端显示
10. **Alternate Screen 检测**: 在 vi/less/top 等 TUI 程序中自动禁用 AI 拦截
