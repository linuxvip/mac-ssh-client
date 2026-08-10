# SSH Client 功能测试文档

| 项目 | 内容 |
|------|------|
| 被测系统 | SSH Client（macOS 桌面 SSH 客户端） |
| 版本 | 1.0.0 |
| 测试类型 | 功能测试 + 自动化测试 + 静态代码审查 |
| 测试日期 | 2026-08-10 |
| 测试执行 | opencode（自动化）|
| 测试结论 | 通过（自动化 42/42）；部分人工依赖项待验证 |

---

## 1. 测试概述

### 1.1 测试目标
- 验证项目核心功能模块是否按需求正常工作
- 运行现有自动化测试套件并统计覆盖率
- 验证构建产物可正常产出
- 通过静态代码审查识别功能缺陷、死代码与安全风险
- 输出可复用的功能测试用例矩阵，供人工回归使用

### 1.2 测试范围
| 范围 | 说明 |
|------|------|
| 在范围内 | 构建与类型检查、自动化单元/组件测试、AI 命令分类、系统监控解析、标签栏交互、SSH/SFTP/端口转发主进程逻辑（静态审查）、UI 组件逻辑（静态审查） |
| 范围外 | 真实服务器 SSH 连通性实测、GUI 人工操作回归（需要真实远端主机与人工操作，见 §9 待验证清单） |

---

## 2. 测试环境

| 类别 | 配置 |
|------|------|
| 操作系统 | macOS（darwin，本机环境） |
| Node.js | 版本满足 `>=18`（npm 报告无版本错误） |
| 包管理器 | npm（package-lock 已锁定） |
| 依赖 | Electron 31 / React 18 / TypeScript 5.5 / Vite 5.4.21 / vitest 4.1.10 / ssh2 |
| 测试框架 | Vitest + jsdom + @testing-library/react |
| 覆盖率工具 | @vitest/coverage-v8 |

---

## 3. 测试方法与工具

| 方法 | 工具 | 用途 |
|------|------|------|
| 自动化测试 | `npm test`（vitest run） | 执行既有 42 条测试用例 |
| 覆盖率统计 | `npm run test:coverage` | 量化代码覆盖程度 |
| 构建验证 | `npm run build`（electron-vite build） | 验证主进程 / preload / 渲染进程可正常编译 |
| 静态代码审查 | 人工逐文件审查 + grep 交叉验证 | 识别缺陷、死代码、安全隐患、重复代码 |

---

## 4. 执行结果摘要

| 项目 | 结果 |
|------|------|
| 自动化测试 | ✅ **42/42 通过**（3 个测试文件，1.67s） |
| 覆盖率 | ⚠️ 语句 54.09% / 分支 43.28% / 函数 50% / 行 54.46% |
| 生产构建 | ✅ 成功（main 36.26 kB / preload 3.84 kB / renderer CSS 39.14 kB + JS 789.26 kB） |
| 静态审查发现 | ⚠️ 4 项（见 §7） |

---

## 5. 自动化测试结果

### 5.1 执行输出（摘要）
```
Test Files  3 passed (3)
     Tests  42 passed (42)
 Duration  1.67s
```

### 5.2 覆盖率明细

| 文件 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|------|
| `main/ai.ts` | 93.47% | 65% | 100% | 93.33% |
| `components/TabBar.tsx` | 30.26% | 34.04% | 41.66% | 28.35% |
| 全项目 | 54.09% | 43.28% | 50% | 54.46% |

> **重要发现**：`main/monitor.ts`、`main/ssh.ts`、`main/sftp.ts`、`main/store.ts`、`main/index.ts` 及多数 UI 组件（Terminal、FileManager、AIPanel、MonitorOverlay、PortForward、SettingsDialog、SplitTerminal、App 等）**无自动化测试覆盖**。`tests/unit/monitor.test.ts` 在测试文件中**内联复制**了解析函数而非导入生产代码，导致该文件虽含 17 条用例，但对生产代码覆盖贡献为 0（见缺陷 B-2）。

### 5.3 用例分布

| 测试文件 | 数量 | 覆盖内容 |
|----------|------|----------|
| `tests/unit/ai.test.ts` | 18 | AI_PRESETS 完整性、系统信息收集/缓存/容错、命令分类（command/ai/error）、Markdown 包裹 JSON 提取、失败重试、API 错误处理 |
| `tests/unit/monitor.test.ts` | 17 | CPU/内存/磁盘/网络解析函数（内联副本） |
| `tests/components/TabBar.test.tsx` | 7 | 标签渲染、状态点、右键菜单项、克隆/断开入口 |

---

## 6. 功能测试用例矩阵

> 说明：**自动化** = 由自动化测试或构建验证；**静态审查** = 通过代码审查确认逻辑正确；**人工待验** = 需真实远端与人工 GUI 操作验证。

### 6.1 SSH 连接
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| SSH-01 | P0 | 使用用户名+密码连接目标主机 | 建立会话，shell 流双向可用，终端显示输出 | 逻辑经审查正确（ssh.ts） | 静态审查 |
| SSH-02 | P0 | 使用私钥路径认证（含 `~` 展开） | 正确读取私钥并认证 | `readKey` 处理 `~` 展开与文件不存在容错 | 静态审查 |
| SSH-03 | P0 | 测试连接（`ssh:test-connection`） | 执行 `echo ok` 校验，返回 success/error | 超时 10s、双端错误均正确归因 | 静态审查 |
| SSH-04 | P1 | 经跳板机连接目标（forwardOut） | 跳板→目标链路建立，断开时释放跳板连接 | 三步流程与错误回滚完整 | 静态审查 |
| SSH-05 | P0 | 断开连接 | 关闭 stream/client/jumpClient，移除会话 | 释放逻辑完整 | 静态审查 |
| SSH-06 | P1 | resize 同步远端 pty | `stream.setWindow(rows, cols)` | 实现正确（index.ts:99-104） | 静态审查 |

### 6.2 终端（xterm.js）
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| TERM-01 | P0 | 多标签同时连接 | 每标签独立会话与 xterm 实例 | Terminal 按 tab.id 独立实例化 | 静态审查 |
| TERM-02 | P1 | 窗口缩放触发 resize | fit 后发送新 cols/rows | onResize + 防抖 resync | 静态审查 |
| TERM-03 | P1 | vi/less/top 进入 Alternate Screen | 检测 `\x1b[?1049h` 后禁用 AI 拦截，退出后恢复 | 实现正确（Terminal.tsx:137-143） | 静态审查 |
| TERM-04 | P2 | 中文输入触发 AI 模式（本地回显） | 首个字符为中文或 `?` 进入 AI 模式 | 实现正确，支持退格/清屏/Ctrl+C | 静态审查 |
| TERM-05 | P2 | 选中即复制 | 松开鼠标复制选区，显示"已复制" toast | 防抖 100ms + clipboard 写入 | 静态审查 |
| TERM-06 | P1 | Unicode 中文/Emoji 宽度 | 加载字素簇/Unicode11 插件 | 双保险降级加载 | 静态审查 |
| TERM-07 | P1 | 分屏（左右/上下）、拖分隔条调比例 | 分屏渲染、ratio 0.15–0.85 约束 | SplitTerminal 实现正确 | 静态审查 |

### 6.3 连接管理（侧边栏）
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| CONN-01 | P0 | 新建/编辑/保存连接 | 持久化到 connections.json | store.ts 读写 + 双格式兼容 | 静态审查 |
| CONN-02 | P1 | 分组创建/重命名/删除/折叠 | 组 CRUD 同步持久化 | App.tsx 逻辑正确 | 静态审查 |
| CONN-03 | P1 | 拖拽连接排序/跨组拖动 | 更新 groupId 与顺序并持久化 | DnD 处理正确 | 静态审查 |
| CONN-04 | P1 | 搜索主机名/IP/用户名 | 扁平过滤列表 | 实现正确 | 静态审查 |
| CONN-05 | P2 | 右键菜单（连接/编辑/删除/重命名） | 上下文操作生效 | 实现正确 | 静态审查 |

### 6.4 AI 命令助手
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| AI-01 | P0 | 7 家服务商预设存在且非空 | 预设含 apiUrl/model | ✅ 自动化通过 | 自动化 |
| AI-02 | P0 | 收集系统信息（OS/内核/用户） | 正确拼接并缓存 | ✅ 自动化通过（含缓存/分会话/容错） | 自动化 |
| AI-03 | P0 | 直接命令输入分类 | 返回 `type:"command"` | ✅ 自动化通过 | 自动化 |
| AI-04 | P0 | 自然语言生成命令 | 返回 `type:"ai"` 含 cmd/explain | ✅ 自动化通过 | 自动化 |
| AI-05 | P1 | Markdown 包裹 JSON 响应 | 正确提取 JSON | ✅ 自动化通过 | 自动化 |
| AI-06 | P1 | 首次无 JSON 时重试一次 | 二次请求并成功解析 | ✅ 自动化通过 | 自动化 |
| AI-07 | P0 | API 失败 / 非 200 / 未配置 | 返回 error 类型 | ✅ 自动化通过 | 自动化 |
| AI-08 | P2 | AI 面板执行/复制按钮 | 命令注入活动会话 | `onExecute` 逻辑正确 | 静态审查 |

### 6.5 文件管理（SFTP / Exec 双模式）
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| FM-01 | P0 | 列出目录（SFTP readdir） | 排序：目录在前，按名称 | 实现正确，过滤 `.`/`..` | 静态审查 |
| FM-02 | P0 | SFTP 不可用时回退 exec `ls -la` | 解析多平台 ls 格式（GNU/BusyBox/macOS） | 解析器覆盖 8+ 列与符号链接 | 静态审查 |
| FM-03 | P1 | 上传（SFTP + exec `cat >` 回退） | 进度事件实时发送，完成刷新 | 实现正确 | 静态审查 |
| FM-04 | P1 | 下载（SFTP + exec `cat` 回退） | 进度/保存对话框/失败清理 | 失败时删除半成品文件 | 静态审查 |
| FM-05 | P1 | 删除/重命名/新建（双模式回退） | 对应 SFTP API 或 shell 命令 | 实现正确 | 静态审查 |
| FM-06 | P2 | 右键菜单、路径导航、返回上级 | 交互正确 | 实现正确 | 静态审查 |

### 6.6 系统监控
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| MON-01 | P0 | 解析 `/proc/stat` CPU 行 | idle=idle+iowait，total 正确 | 解析逻辑正确（但测试为副本，见 B-2） | 静态审查 |
| MON-02 | P0 | 解析 `/proc/meminfo` | MemAvailable 优先，无则 total-free | 逻辑正确 | 静态审查 |
| MON-03 | P0 | 解析 `df -B1` 磁盘行 | 取 1B-blocks/Used 计算百分比 | 逻辑正确 | 静态审查 |
| MON-04 | P0 | 解析 `/proc/net/dev`（排除 lo） | 汇总 RX/TX 字节数 | 逻辑正确 | 静态审查 |
| MON-05 | P1 | 2s 轮询 + 远程时间戳算网速 | 精确计算速率，会话关闭自动停止 | 实现正确 | 静态审查 |
| MON-06 | P2 | 环形仪表盘颜色渐变告警 | >85% 红 / >=60% 橙 / 其余绿 | 实现正确 | 静态审查 |

### 6.7 端口转发
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| PF-01 | P0 | 启动本地端口 → 远程端口隧道 | net.Server + forwardOut 双向管道 | 实现正确（ssh.ts:302-339） | 静态审查 |
| PF-02 | P1 | 停止隧道 / 端口被占用报错 | 关闭 server 并清理，错误回传 | 实现正确 | 静态审查 |
| PF-03 | P1 | 侧边栏隧道列表增删与状态 | connecting→active/error | 实现正确 | 静态审查 |
| PF-04 | P2 | PortForwardPanel 复用入口 | 该组件未在任何入口引用 | ⚠️ 死代码（见 B-1） | 缺陷 |

### 6.8 主题 / UI / 持久化
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| UI-01 | P1 | 6 套主题切换并持久化 | CSS 变量更新 + settings.json 保存 | themes.ts 写入 `--term-*` 等变量 | 静态审查 |
| UI-02 | P1 | 侧边栏拖拽调宽（160–400px） | 边界约束 | 实现正确 | 静态审查 |
| UI-03 | P1 | 设置保存 AI 配置 / 选中即复制 | settings.json 持久化 | 实现正确 | 静态审查 |
| UI-04 | P2 | 空状态 / 错误提示 / toast | 各状态有 UI 反馈 | 实现正确 | 静态审查 |

### 6.9 构建与打包
| 用例 ID | 优先级 | 测试步骤 | 预期结果 | 实际结果 | 状态 |
|---------|--------|----------|----------|----------|------|
| BLD-01 | P0 | `npm run build` | 三个目标产物正常输出 | ✅ 构建成功 | 自动化 |
| BLD-02 | P0 | `npm test` | 全部通过 | ✅ 42/42 | 自动化 |
| BLD-03 | P2 | `npm run dist`（DMG） | 产出安装包 | 未执行（需签名/耗时） | 人工待验 |

---

## 7. 缺陷清单

| 编号 | 严重级别 | 模块 | 位置 | 描述 | 建议 |
|------|----------|------|------|------|------|
| B-1 | 低（P3） | 端口转发 | `src/renderer/src/components/PortForwardPanel.tsx` | **死代码**：全项目无任何引用（已 grep 确认），与其功能重复的 `PortForwardView.tsx` 为实际入口；`ForwardRule` 类型亦仅此处使用 | 删除该文件及无用类型，或并入 PortForwardView |
| B-2 | 中（P2） | 测试 | `tests/unit/monitor.test.ts` | **测试复制实现**：解析函数在测试中内联复制而非从 `src/main/monitor.ts` 导入，导致 17 条用例对生产代码覆盖率贡献为 0；一旦生产逻辑改动，测试可能“测旧代码”，产生假绿 | 改为从 `monitor.ts` 导出纯函数并直接导入测试；或将解析函数抽到无 Electron 依赖的独立模块 |
| B-3 | 中（P2） | 安全 | `src/main/store.ts` / 渲染层 | **明文存储凭据**：连接密码与跳板机密码以明文 JSON 保存在 `connections.json` | 使用 `safeStorage`（Electron 提供）加密密码；至少提示用户风险 |
| B-4 | 低（P3） | 一致性 | `src/renderer/src/components/Terminal.tsx:202` | 使用 `(window as any).api.ai` 绕过类型声明，与其余 `window.api.*` 风格不一致 | 统一走 preload 暴露的类型化 `window.api` |

### 潜在风险（未判为缺陷，建议关注）
- **R-1**（中）`PortForwardView.handleAdd` 为建立隧道会以 `sessionId=tunnelId` 创建 SSH 连接并开启 shell，但未监听任何输出事件——shell 资源占用但无终端展示，属低效实现，非功能性缺陷。
- **R-2**（低）监控命令依赖 `date +%s%N`（纳秒），BusyBox 精简系统可能不支持，将导致网速恒为 0（其余指标不受影响）。
- **R-3**（低）`npm run dist` 未做代码签名，分发时 Gatekeeper 可能拦截。
- **R-4**（低）构建存在 Vite CJS deprecation 与 `oxc` 相关警告（不影响产物）。

---

## 8. 覆盖率缺口分析

| 未覆盖模块 | 风险 | 建议优先级 |
|-----------|------|-----------|
| `main/ssh.ts`（连接/隧道核心） | 高——核心链路无回归保障 | P0 |
| `main/sftp.ts`（双模式文件传输） | 高——解析与回退逻辑复杂 | P0 |
| `main/index.ts`（IPC 注册） | 中——通道易漏配 | P1 |
| `main/store.ts`（持久化兼容） | 中——新旧格式兼容 | P1 |
| 渲染组件（Terminal/FileManager/AIPanel/MonitorOverlay/SettingsDialog/SplitTerminal/App） | 高——交互逻辑占比最大 | P1 |

---

## 9. 待人工验证清单（本环境无法自动执行）

| 序号 | 项目 | 前置条件 |
|------|------|----------|
| 1 | 真实主机密码/私钥/跳板机连接 | 可用 SSH 服务器 |
| 2 | 终端输入/回显/中文/Emoji 实测 | 运行 `npm run dev` |
| 3 | SFTP 与 exec 回退模式实测（含 BusyBox 主机） | 具备 SFTP 与精简系统各一台 |
| 4 | 端口转发连通性实测（如本地→远端 MySQL） | 远端服务 |
| 5 | AI 面板与终端内 AI 拦截真机验证 | 配置有效 API Key |
| 6 | 系统监控仪表盘真机显示 | 已连接主机 |
| 7 | DMG 安装、启动、卸载 | `npm run dist` |

---

## 10. 结论与建议

### 10.1 结论
- **自动化测试**：通过（42/42），构建成功，`ai.ts` 核心逻辑覆盖良好（93%+）。
- **功能完整度**：代码审查确认 SSH/跳板机/终端/分屏/AI/文件管理/监控/端口转发/主题等模块逻辑完整、边界处理到位。
- **主要短板**：覆盖率整体偏低（54%），SSH/SFTP/监控/UI 核心链路无自动化回归；存在死代码与明文凭据存储问题。

### 10.2 建议
1. **P0**：为 `ssh.ts`、`sftp.ts` 补齐单元测试（mock ssh2 客户端即可）。
2. **P0**：修复 B-2，将 monitor 解析函数导出供测试直接导入。
3. **P1**：使用 Electron `safeStorage` 加密存储密码（B-3）。
4. **P1**：删除死代码 PortForwardPanel（B-1）。
5. **P1**：按 §8 优先级补齐渲染组件测试。
6. **P2**：统一 `window.api` 类型使用（B-4）；按 §9 清单执行人工回归。

---

## 附录 A：执行证据

```bash
# 自动化测试
$ npm test
Test Files  3 passed (3)
     Tests  42 passed (42)
Duration  1.67s

# 覆盖率
$ npm run test:coverage
All files          | 54.09 | 43.28 | 50 | 54.46 |
main/ai.ts         | 93.47 |    65 |100 | 93.33 |
components/TabBar  | 30.26 | 34.04 |41.66 | 28.35 |

# 构建
$ npm run build
out/main/index.js        36.26 kB  ✓
out/preload/index.js      3.84 kB  ✓
out/renderer/index.html   0.39 kB  ✓
out/renderer/assets/*.css 39.14 kB ✓
out/renderer/assets/*.js  789.26 kB ✓
```

## 附录 B：审查范围（文件清单）
- `src/main/`：index.ts, ssh.ts, sftp.ts, ai.ts, monitor.ts, store.ts
- `src/preload/index.ts`
- `src/renderer/src/`：App.tsx, types.ts, themes.ts, main.tsx 及全部 components/
- `tests/`：setup.ts, unit/ai.test.ts, unit/monitor.test.ts, components/TabBar.test.tsx
