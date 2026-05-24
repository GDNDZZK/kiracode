// kilocode_change - new file

import * as vscode from "vscode"
import * as path from "path"
import type { WebSocketServer } from "ws"
import type { WebServerConfig, WebServerStatus, AuthenticatedWebSocket, WebSocketMessage } from "./types"
import { generateServerSecret } from "./auth"
import { createHttpServer } from "./http-server"
import { createWebSocketServer, broadcastToClients } from "./ws-server"
import { WebServerBridge } from "./bridge"
import type { ClineProvider } from "../../core/webview/ClineProvider"

/**
 * Web Server 服务类
 * 编排 HTTP 服务器、WebSocket 服务器和消息桥接的生命周期
 */
export class WebServerService {
	private outputChannel: vscode.OutputChannel
	private httpServer: import("http").Server | null = null
	private wsServer: WebSocketServer | null = null
	private bridge: WebServerBridge | null = null
	private serverSecret: string = ""
	private currentConfig: WebServerConfig | null = null
	private currentStatus: WebServerStatus = { running: false }

	constructor(outputChannel: vscode.OutputChannel) {
		this.outputChannel = outputChannel
	}

	/**
	 * 启动 Web Server
	 * @param config Web Server 配置
	 * @param provider ClineProvider 实例
	 * @returns 服务器运行状态
	 */
	async start(config: WebServerConfig, provider: ClineProvider): Promise<WebServerStatus> {
		if (this.currentStatus.running) {
			this.log("[WebServer] Server is already running, stopping first")
			await this.stop()
		}

		if (!config.enabled) {
			this.log("[WebServer] Web server is disabled in configuration")
			return { running: false }
		}

		if (!config.accessToken) {
			const errorMsg = "Access token is not configured. Please set a token in the Web Server settings."
			this.log(`[WebServer] ${errorMsg}`)
			// kilocode_change: Update currentStatus so getStatus() returns the error
			this.currentStatus = { running: false, error: errorMsg }
			return { ...this.currentStatus }
		}

		try {
			// 生成服务器密钥
			this.serverSecret = generateServerSecret()

			// 确定静态文件路径
			const staticPath = this.getStaticPath()
			// kilocode_change: Determine assets path for serving extension icons
			const assetsPath = this.getAssetsPath()
			this.log(`[WebServer] Static path resolved: ${staticPath}`)
			this.log(`[WebServer] Assets path resolved: ${assetsPath}`)

			// 创建消息桥接
			this.bridge = new WebServerBridge(provider)
			this.bridge.initialize()

			// 创建 HTTP 服务器
			this.httpServer = createHttpServer(config, staticPath, assetsPath, this.serverSecret, (msg) =>
				this.log(msg),
			)

			// 创建 WebSocket 服务器
			this.wsServer = createWebSocketServer(this.httpServer, config, this.serverSecret, (msg) => this.log(msg))

			// 注册 WebSocket 事件处理器
			this.setupWebSocketHandlers(this.wsServer, this.bridge)

			// 启动 HTTP 服务器监听
			await new Promise<void>((resolve, reject) => {
				this.httpServer!.on("error", (error: Error) => {
					this.log(`[WebServer] Server error: ${error.message}`)
					reject(error)
				})

				this.httpServer!.listen(config.port, () => {
					resolve()
				})
			})

			this.currentConfig = config
			this.currentStatus = { running: true, port: config.port }

			this.log(`[WebServer] Server started on port ${config.port}`)
			this.log(`[WebServer] WebSocket available at ws://localhost:${config.port}/ws`)

			return { ...this.currentStatus }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.log(`[WebServer] Failed to start server: ${errorMessage}`)
			this.currentStatus = { running: false, error: errorMessage }

			// 清理可能已创建的资源
			await this.cleanupResources()

			return { ...this.currentStatus }
		}
	}

	/**
	 * 停止 Web Server
	 */
	async stop(): Promise<void> {
		if (!this.currentStatus.running) {
			return
		}

		this.log("[WebServer] Stopping server...")
		await this.cleanupResources()

		this.currentStatus = { running: false }
		this.currentConfig = null
		this.log("[WebServer] Server stopped")
	}

	/**
	 * 重启 Web Server
	 * @param config 新的配置
	 * @param provider ClineProvider 实例
	 * @returns 服务器运行状态
	 */
	async restart(config: WebServerConfig, provider: ClineProvider): Promise<WebServerStatus> {
		this.log("[WebServer] Restarting server...")
		await this.stop()
		return this.start(config, provider)
	}

	/**
	 * 获取当前运行状态
	 * @returns 服务器运行状态
	 */
	getStatus(): WebServerStatus {
		return { ...this.currentStatus }
	}

	/**
	 * 更新配置
	 * 如果服务器正在运行且配置发生变化，自动重启
	 * @param config 新的配置
	 * @param provider ClineProvider 实例
	 */
	async updateConfig(config: WebServerConfig, provider: ClineProvider): Promise<void> {
		const needsRestart = this.shouldRestart(config)

		if (needsRestart && this.currentStatus.running) {
			this.log("[WebServer] Configuration changed, restarting server")
			await this.restart(config, provider)
		} else {
			this.currentConfig = config
			this.log("[WebServer] Configuration updated (no restart needed)")
		}
	}

	/**
	 * 清理所有资源
	 */
	dispose(): void {
		this.log("[WebServer] Disposing WebServerService")
		this.cleanupResourcesSync()
		this.currentStatus = { running: false }
		this.currentConfig = null
	}

	/**
	 * 注册 WebSocket 事件处理器
	 */
	private setupWebSocketHandlers(wss: WebSocketServer, bridge: WebServerBridge): void {
		wss.on("clientConnected", (ws: AuthenticatedWebSocket) => {
			bridge.onClientConnect(ws)
		})

		wss.on("clientMessage", (ws: AuthenticatedWebSocket, message: WebSocketMessage) => {
			bridge.handleWebSocketMessage(ws, message)
		})

		wss.on("clientDisconnected", (ws: AuthenticatedWebSocket) => {
			bridge.onClientDisconnect(ws)
		})

		wss.on("clientError", (ws: AuthenticatedWebSocket, error: Error) => {
			this.log(`[WebServer] Client error: ${error.message}`)
		})
	}

	/**
	 * 获取静态文件路径（webview-ui 构建产物）
	 */
	private getStaticPath(): string {
		// kilocode_change start: Web 构建产物位于 webview-ui/dist-web/（VS Code webview 使用 build/）
		// 修复扩展 ID：publisher 为 "kiracode"，name 为 "kira-code"，所以 ID 是 "kiracode.kira-code"
		const extensionPath = vscode.extensions.getExtension("kiracode.kira-code")?.extensionPath || ""
		if (extensionPath) {
			return path.join(extensionPath, "webview-ui", "dist-web")
		}

		// 开发模式下的回退路径
		// esbuild 将代码打包到 dist/extension.js，所以 __dirname 指向 dist/
		// 从 dist/ 回退到项目根目录下的 webview-ui/dist-web/
		return path.join(__dirname, "..", "webview-ui", "dist-web")
		// kilocode_change end
	}

	// kilocode_change start: Add getAssetsPath for serving extension icons
	/**
	 * 获取扩展资源路径（图标等）
	 * 图标文件位于 src/assets/icons/ 目录
	 */
	private getAssetsPath(): string {
		const extensionPath = vscode.extensions.getExtension("kiracode.kira-code")?.extensionPath || ""
		if (extensionPath) {
			return path.join(extensionPath, "src", "assets")
		}

		// 开发模式下的回退路径
		return path.join(__dirname, "..", "src", "assets")
	}
	// kilocode_change end

	/**
	 * 检查配置变化是否需要重启
	 */
	private shouldRestart(newConfig: WebServerConfig): boolean {
		if (!this.currentConfig) {
			return true
		}

		return (
			this.currentConfig.port !== newConfig.port ||
			this.currentConfig.accessToken !== newConfig.accessToken ||
			this.currentConfig.enabled !== newConfig.enabled
		)
	}

	/**
	 * 异步清理所有资源
	 */
	private async cleanupResources(): Promise<void> {
		// 清理桥接
		if (this.bridge) {
			this.bridge.dispose()
			this.bridge = null
		}

		// 关闭 WebSocket 服务器
		if (this.wsServer) {
			await new Promise<void>((resolve) => {
				this.wsServer!.close(() => {
					resolve()
				})
			})
			this.wsServer = null
		}

		// 关闭 HTTP 服务器
		if (this.httpServer) {
			await new Promise<void>((resolve) => {
				this.httpServer!.close(() => {
					resolve()
				})
			})
			this.httpServer = null
		}
	}

	/**
	 * 同步清理所有资源（用于 dispose）
	 */
	private cleanupResourcesSync(): void {
		if (this.bridge) {
			this.bridge.dispose()
			this.bridge = null
		}

		if (this.wsServer) {
			this.wsServer.close()
			this.wsServer = null
		}

		if (this.httpServer) {
			this.httpServer.close()
			this.httpServer = null
		}
	}

	/**
	 * 日志输出
	 */
	private log(message: string): void {
		this.outputChannel.appendLine(message)
	}
}
