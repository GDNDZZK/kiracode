# Kilo Code → Kira Code 重命名影响范围研究报告

## 重命名方案

| 字段           | 当前值               | 目标值               |
| -------------- | -------------------- | -------------------- |
| 显示名称       | Kilo Code            | Kira Code            |
| name 字段      | kilo-code            | kira-code            |
| publisher 字段 | kilocode             | kiracode             |
| 最终扩展 ID    | `kilocode.kilo-code` | `kiracode.kira-code` |

---

## 一、关键架构发现

### 动态名称机制

[`src/shared/package.ts`](src/shared/package.ts:1) 中的 `Package` 对象从 `package.json` 读取 `name` 和 `publisher`：

```typescript
export const Package = {
	publisher,
	name: process.env.PKG_NAME || name, // 可被构建时环境变量覆盖
	version: process.env.PKG_VERSION || version,
	outputChannel: process.env.PKG_OUTPUT_CHANNEL || "Kilo-Code",
}
```

**影响**：修改 `src/package.json` 的 `name` 字段后，所有使用 `Package.name` 的地方会自动更新，包括：

- [`ClineProvider.sideBarId`](src/core/webview/ClineProvider.ts:154) = `${Package.name}.SidebarProvider`
- [`ClineProvider.tabPanelId`](src/core/webview/ClineProvider.ts:155) = `${Package.name}.TabPanelProvider`

### Nightly 构建参考

[`apps/vscode-nightly/esbuild.mjs`](apps/vscode-nightly/esbuild.mjs:36) 展示了构建时覆盖名称的模式：

- `process.env.PKG_NAME` = `"kilo-code-nightly"`
- `generatePackageJson` 的 `substitution` 参数自动替换 `package.json` 中的 `kilo-code` → `kilo-code-nightly`

---

## 二、必须修改的文件

### 2.1 `src/package.json` — 扩展清单

| 位置              | 字段                                | 当前值                                                  | 目标值                                                  |
| ----------------- | ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 行2               | `name`                              | `"kilo-code"`                                           | `"kira-code"`                                           |
| 行5               | `publisher`                         | `"kilocode"`                                            | `"kiracode"`                                            |
| 行20              | `author.name`                       | `"Kilo Code"`                                           | `"Kira Code"`                                           |
| 行36-38           | `keywords`                          | `"kilo"`, `"Kilo Code"`, `"kilocode"`                   | `"kira"`, `"Kira Code"`, `"kiracode"`                   |
| 行65              | `walkthroughs[0].id`                | `"kiloCodeWalkthrough"`                                 | `"kiraCodeWalkthrough"`                                 |
| 行66              | `walkthroughs[0].title`             | `"5 ways Kilo Code helps you code"`                     | `"5 ways Kira Code helps you code"`                     |
| 行72,80,91,99,107 | walkthrough descriptions            | 包含 "Kilo Code"                                        | 替换为 "Kira Code"                                      |
| 行118             | `viewsContainers.activitybar[0].id` | `"kilo-code-ActivityBar"`                               | `"kira-code-ActivityBar"`                               |
| 行126             | `views` 父级引用                    | `"kilo-code-ActivityBar"`                               | `"kira-code-ActivityBar"`                               |
| 行129             | `views[0].id`                       | `"kilo-code.SidebarProvider"`                           | `"kira-code.SidebarProvider"`                           |
| 行138-310         | 所有 `commands[*].command`          | `"kilo-code.xxx"`                                       | `"kira-code.xxx"`                                       |
| 行315,319         | `menus` submenu 引用                | `"kilo-code.contextMenu"`                               | `"kira-code.contextMenu"`                               |
| 行339,343         | `menus` terminalMenu 引用           | `"kilo-code.terminalMenu"`                              | `"kira-code.terminalMenu"`                              |
| 行361-397         | `menus` when 条件                   | `view == kilo-code.SidebarProvider`                     | `view == kira-code.SidebarProvider`                     |
| 行403-418         | `menus` when 条件                   | `activeWebviewPanelId == kilo-code.TabPanelProvider`    | `activeWebviewPanelId == kira-code.TabPanelProvider`    |
| 行441-483         | `keybindings` command 引用          | `"kilo-code.xxx"`                                       | `"kira-code.xxx"`                                       |
| 行451             | `keybindings` when 条件             | `kilocode.autocomplete.hasSuggestions`                  | `kiracode.autocomplete.hasSuggestions`                  |
| 行456,462         | `keybindings` when 条件             | `kilocode.autocomplete.enableSmartInlineTaskKeybinding` | `kiracode.autocomplete.enableSmartInlineTaskKeybinding` |
| 行487             | `submenus[0].id`                    | `"kilo-code.contextMenu"`                               | `"kira-code.contextMenu"`                               |
| 行491             | `submenus[1].id`                    | `"kilo-code.terminalMenu"`                              | `"kira-code.terminalMenu"`                              |
| 行638             | `icons` id                          | `"kilo-logo"`                                           | `"kira-logo"`                                           |
| 行639             | `icons` description                 | `"Kilo Code logo"`                                      | `"Kira Code logo"`                                      |
| 行667             | `scripts["vsix:unpacked"]`          | `kilo-code-*.vsix`                                      | `kira-code-*.vsix`                                      |

**注意**：`contributes.configuration` 中的所有 `kilo-code.xxx` 属性键名 **不应修改**。

### 2.2 `src/package.nls.json` — 本地化字符串

| 字段                                          | 当前值                                   | 目标值                                   | 备注             |
| --------------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------- |
| `extension.displayName`                       | `"Kilo Code: AI Coding Agent..."`        | `"Kira Code: AI Coding Agent..."`        |                  |
| `views.contextMenu.label`                     | `"Kilo Code"`                            | `"Kira Code"`                            |                  |
| `views.terminalMenu.label`                    | `"Kilo Code"`                            | `"Kira Code"`                            |                  |
| `views.activitybar.title`                     | `"Kilo Code"`                            | `"Kira Code"`                            | 侧边栏标题       |
| `views.sidebar.name`                          | `"Kilo Code"`                            | `"Kira Code"`                            |                  |
| `command.terminal.generateCommand.title`      | `"Kilo Code: Generate Terminal Command"` | `"Kira Code: Generate Terminal Command"` |                  |
| `command.generateCommitMessage.title`         | `"Generate Commit Message with Kilo"`    | `"Generate Commit Message with Kira"`    |                  |
| `configuration.title`                         | `"Kilo Code"`                            | **不修改**                               | 用户明确要求保留 |
| `settings.customStoragePath.description`      | 包含 `KiloCodeStorage`                   | 可选修改                                 |                  |
| `settings.enableCodeActions.description`      | `"Enable Kilo Code quick fixes"`         | `"Enable Kira Code quick fixes"`         |                  |
| `settings.autoImportSettingsPath.description` | 包含 `kilo-code-settings.json`           | 可选修改                                 |                  |
| `settings.enableSettingsSync.description`     | 包含 `Kilo Code settings`                | `"Kira Code settings"`                   |                  |

### 2.3 `src/shared/package.ts` — Package 常量

| 字段            | 当前值        | 目标值        |
| --------------- | ------------- | ------------- |
| `outputChannel` | `"Kilo-Code"` | `"Kira-Code"` |

### 2.4 源代码中硬编码的命令 ID（必须与 package.json 匹配）

以下文件包含硬编码的 `"kilo-code."` 命令前缀，需要改为 `"kira-code."`：

| 文件                                                                                                                            | 硬编码值                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`src/activate/registerCommands.ts`](src/activate/registerCommands.ts:241)                                                      | `"kilo-code.SidebarProvider.focus"`                                                    |
| [`src/utils/autoLaunchingTask.ts`](src/utils/autoLaunchingTask.ts:29)                                                           | `"kilo-code.SidebarProvider.focus"`, `"kilo-code.newTask"`                             |
| [`src/extension.ts`](src/extension.ts:388)                                                                                      | `"kilo-code.SidebarProvider.focus"`                                                    |
| [`src/core/kilocode/agent-manager/AgentManagerProvider.ts`](src/core/kilocode/agent-manager/AgentManagerProvider.ts:70)         | `viewType = "kilo-code.AgentManagerPanel"`                                             |
| [`src/services/terminal-welcome/TerminalWelcomeService.ts`](src/services/terminal-welcome/TerminalWelcomeService.ts:42)         | `"kilo-code.generateTerminalCommand"`                                                  |
| [`src/services/commit-message/CommitMessageProvider.ts`](src/services/commit-message/CommitMessageProvider.ts:40)               | `"kilo-code.vsc.generateCommitMessage"`, `"kilo-code.jetbrains.generateCommitMessage"` |
| [`src/core/webview/webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts:1769)                                   | `"kilo-code."` 用于快捷键搜索                                                          |
| [`src/core/webview/webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts:2107)                                   | `"kilo-code.autocomplete.reload"`                                                      |
| [`src/services/autocomplete/index.ts`](src/services/autocomplete/index.ts:16)                                                   | 多个 `"kilo-code.autocomplete.*"` 命令注册                                             |
| [`src/services/autocomplete/AutocompleteServiceManager.ts`](src/services/autocomplete/AutocompleteServiceManager.ts:360)        | `"kilo-code.autocomplete.disable"`                                                     |
| [`src/services/autocomplete/AutocompleteCodeActionProvider.ts`](src/services/autocomplete/AutocompleteCodeActionProvider.ts:20) | `"kilo-code.autocomplete.generateSuggestions"`                                         |
| [`src/services/autocomplete/AutocompleteJetbrainsBridge.ts`](src/services/autocomplete/AutocompleteJetbrainsBridge.ts:13)       | `"kilo-code.jetbrains.getInlineCompletions"`                                           |
| [`src/services/web-server/index.ts`](src/services/web-server/index.ts:196)                                                      | `"kilo-code.kilo-code"` 扩展 ID 查找                                                   |

### 2.5 VS Code 上下文键（when 条件中使用）

这些是编程式设置的上下文键，需要与 `package.json` 的 keybinding when 条件匹配：

| 文件                                                                                                                                                                                     | 当前上下文键                                            | 目标上下文键                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| [`src/services/autocomplete/AutocompleteServiceManager.ts`](src/services/autocomplete/AutocompleteServiceManager.ts:290)                                                                 | `kilocode.autocomplete.enableSmartInlineTaskKeybinding` | `kiracode.autocomplete.enableSmartInlineTaskKeybinding` |
| [`src/services/autocomplete/classic-auto-complete/AutocompleteInlineCompletionProvider.ts`](src/services/autocomplete/classic-auto-complete/AutocompleteInlineCompletionProvider.ts:172) | `kilocode.autocomplete.inline-completion.accepted`      | `kiracode.autocomplete.inline-completion.accepted`      |

---

## 三、应该修改的文件（UI 中用户可见的名称）

### 3.1 webview-ui i18n 翻译文件（大量文件）

所有语言环境目录下包含 "Kilo Code" 的 JSON 文件都需要替换。涉及的语言环境：

- `webview-ui/src/i18n/locales/en/` — 所有 .json 文件
- `webview-ui/src/i18n/locales/sk/`
- `webview-ui/src/i18n/locales/pt-BR/`
- `webview-ui/src/i18n/locales/hi/`
- `webview-ui/src/i18n/locales/ru/`
- `webview-ui/src/i18n/locales/th/`
- `webview-ui/src/i18n/locales/ca/`
- `webview-ui/src/i18n/locales/tr/`
- 其他所有语言环境目录

每个语言环境受影响的文件：

- `chat.json` — 大量 "Kilo Code" 引用（工具操作描述、公告等）
- `welcome.json` — 问候语、介绍文本
- `settings.json` — 设置描述中的 "Kilo Code"
- `mcp.json` — MCP 功能描述
- `prompts.json` — 模式相关描述
- `marketplace.json` — 标题
- `kilocode.json` — Kilo Code 特有功能描述
- `agentManager.json` — 代理管理器相关
- `account.json` — 账户相关
- `cloud.json` — 云服务相关

### 3.2 webview-ui 源代码文件

| 文件                                                                                                                                           | 内容                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [`webview-ui/src/utils/slash-commands.ts`](webview-ui/src/utils/slash-commands.ts:33)                                                          | `"Initialize Kilo Code for this workspace"` |
| [`webview-ui/src/kilocode/agent-manager/components/KiloLogo.tsx`](webview-ui/src/kilocode/agent-manager/components/KiloLogo.tsx:28)            | SVG 中 `id="Kilo_Code_Branding"`            |
| [`webview-ui/src/components/kilocode/settings/providers/KiloCode.tsx`](webview-ui/src/components/kilocode/settings/providers/KiloCode.tsx:124) | `serviceName="Kilo Code"`                   |

---

## 四、不应修改的内容

### 4.1 配置键名（保持 `kilo-code` 前缀）

`src/package.json` 中 `contributes.configuration.properties` 的所有键名：

- `kilo-code.allowedCommands`
- `kilo-code.deniedCommands`
- `kilo-code.commandExecutionTimeout`
- `kilo-code.commandTimeoutAllowlist`
- `kilo-code.preventCompletionWithOpenTodos`
- `kilo-code.vsCodeLmModelSelector`
- `kilo-code.customStoragePath`
- `kilo-code.enableCodeActions`
- `kilo-code.autoImportSettingsPath`
- `kilo-code.maximumIndexedFilesForFileSearch`
- `kilo-code.useAgentRules`
- `kilo-code.apiRequestTimeout`
- `kilo-code.newTaskRequireTodos`
- `kilo-code.enableSettingsSync`
- `kilo-code.codeIndex.embeddingBatchSize`
- `kilo-code.toolProtocol`
- `kilo-code.debug`
- `kilo-code.debugProxy.enabled`
- `kilo-code.debugProxy.serverUrl`
- `kilo-code.debugProxy.tlsInsecure`

### 4.2 Settings Sync 内部键名

[`src/services/settings-sync/__tests__/SettingsSyncService.spec.ts`](src/services/settings-sync/__tests__/SettingsSyncService.spec.ts:43) 中列出的同步键：

- `kilo-code.allowedCommands`
- `kilo-code.deniedCommands`
- `kilo-code.autoApprovalEnabled`
- `kilo-code.fuzzyMatchThreshold`
- `kilo-code.diffEnabled`
- `kilo-code.directoryContextAddedContext`
- `kilo-code.language`
- `kilo-code.customModes`
- `kilo-code.firstInstallCompleted`
- `kilo-code.telemetrySetting`

### 4.3 configuration.title

`src/package.nls.json` 中的 `"configuration.title": "Kilo Code"` — 用户明确要求保留。

### 4.4 URL 和外部链接

- `repository.url`: `"https://github.com/Kilo-Org/kilocode"` — 不修改
- `homepage`: `"https://kilo.ai"` — 不修改
- i18n 中的所有 URL 链接（如 `kilo.ai/discord`、`reddit.com/r/kilocode` 等）

### 4.5 内部包名

- `packages/` 中的 `@kilocode/xxx`、`@roo-code/xxx` 包名 — 不修改
- `pnpm-workspace.yaml` 中的包引用 — 不修改

---

## 五、修改策略建议

### 策略 A：直接全局替换（推荐）

1. 修改 `src/package.json` 的 `name`、`publisher`、`displayName` 等核心字段
2. 全局搜索替换源代码中所有硬编码的 `"kilo-code"` → `"kira-code"`
3. 全局搜索替换所有用户可见的 `"Kilo Code"` → `"Kira Code"`（包括 i18n 文件）
4. 全局搜索替换上下文键 `"kilocode.` → `"kiracode."`
5. 保留配置键名、URL、内部包名不变

### 策略 B：利用构建时替换（类似 nightly）

参考 nightly 构建模式，在 esbuild 中通过 `process.env.PKG_NAME` 和 `generatePackageJson` 的 `substitution` 参数实现运行时替换。但这只能解决部分问题，i18n 文件和硬编码引用仍需手动修改。

**建议采用策略 A**，因为更直接、更彻底。

---

## 六、修改清单总结

| 类别            | 文件数量 | 修改类型                       |
| --------------- | -------- | ------------------------------ |
| 核心清单文件    | 2        | package.json, package.nls.json |
| 共享常量        | 1        | shared/package.ts              |
| 源代码硬编码    | ~13      | .ts 文件中的命令 ID            |
| 上下文键        | ~2       | .ts 文件中的 setContext 调用   |
| i18n 翻译文件   | ~50+     | 所有语言环境的 JSON 文件       |
| webview-ui 组件 | ~3       | React 组件中的显示文本         |
| **总计**        | **~70+** |                                |

---

## 七、风险点

1. **命令 ID 变更**：用户之前绑定的快捷键可能失效（因为命令 ID 变了）
2. **扩展 ID 变更**：用户设置不会自动迁移（因为扩展 ID 从 `kilocode.kilo-code` 变为 `kiracode.kira-code`）
3. **上下文键变更**：`kilocode.autocomplete.*` 变为 `kiracode.autocomplete.*`，需确保 `package.json` 的 when 条件和代码中的 `setContext` 调用同步修改
4. **测试文件**：`SettingsSyncService.spec.ts` 中硬编码了 `kilo-code.*` 配置键名，这些不应修改（因为是测试配置键同步的）
