// kilocode_change - new file

import { WebSocket } from "ws"
import type { AuthenticatedWebSocket, WebSocketMessage } from "./types"
import type { ExtensionMessage } from "@roo-code/types"
import { webviewMessageHandler } from "../../core/webview/webviewMessageHandler"
import type { ClineProvider } from "../../core/webview/ClineProvider"

/**
 * 消息桥接类，负责 WebSocket 和 ClineProvider 之间的消息转换和传递
 *
 * 设计思路：
 * - 入站消息（WebSocket → ClineProvider）：将 WebSocketMessage 转换为 WebviewMessage 格式，
 *   通过 webviewMessageHandler 处理
 * - 出站消息（ClineProvider → WebSocket）：通过包装 postMessageToWebview 方法，
 *   拦截 ExtensionMessage 并广播给所有已认证的 WebSocket 客户端
 */
export class WebServerBridge {
	private provider: ClineProvider
	private clients: Set<AuthenticatedWebSocket> = new Set()
	private originalPostMessageToWebview: ((message: ExtensionMessage) => Promise<void>) | null = null
	private isPatched = false
	private handler: typeof webviewMessageHandler

	constructor(provider: ClineProvider, handler?: typeof webviewMessageHandler) {
		this.provider = provider
		this.handler = handler || webviewMessageHandler
	}

	/**
	 * 初始化桥接，包装 provider 的 postMessageToWebview 方法
	 * 这样所有从 ClineProvider 发出的消息都会同时发送到 WebSocket 客户端
	 */
	initialize(): void {
		if (this.isPatched) {
			return
		}

		// 保存原始方法引用
		this.originalPostMessageToWebview = this.provider.postMessageToWebview.bind(this.provider)

		// 替换为包装版本
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const bridge = this
		this.provider.postMessageToWebview = async function (message: ExtensionMessage) {
			// 先调用原始方法发送到 VS Code webview
			await bridge.originalPostMessageToWebview!(message)

			// 同时广播给所有 WebSocket 客户端
			bridge.broadcastToClients(message)
		}

		this.isPatched = true
		this.provider.log("[WebServer] Bridge initialized, postMessageToWebview wrapped")
	}

	/**
	 * 处理来自 WebSocket 客户端的消息
	 * @param ws 发送消息的 WebSocket 连接
	 * @param message WebSocket 消息
	 */
	async handleWebSocketMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
		if (!ws.isAuthenticated) {
			this.provider.log("[WebServer] Ignoring message from unauthenticated client")
			return
		}

		try {
			// kilocode_change: Fix message unwrapping logic.
			// The frontend sends WebviewMessage directly via WebTransport.postMessage(),
			// which serializes the message as-is (e.g., {type: "mode", text: "architect"}).
			// The WebSocket server parses this into a WebSocketMessage {type, payload}.
			// However, the entire WebviewMessage is stored in message.payload when the
			// frontend sends it directly (not wrapped as {type: 'message', payload: ...}).
			// We need to detect both cases:
			// 1. Direct WebviewMessage: {type: "mode", text: "architect"} -> parsed as {type: "mode", payload: "architect"} (wrong!)
			//    Actually, JSON.parse preserves the structure, so {type: "mode", text: "architect"}
			//    becomes WebSocketMessage {type: "mode", payload: undefined, text: "architect"}
			//    But the WebSocketMessage type only has type and payload, so extra fields
			//    are preserved by JSON.parse but not typed.
			// 2. Wrapped message from broadcastToClients: {type: "state", payload: {type: "state", state}}
			//
			// The correct approach: if payload exists and is an object with a 'type' field,
			// it's a wrapped ExtensionMessage from broadcastToClients (incoming direction shouldn't
			// have this). For incoming messages from the frontend, the entire message IS the
			// WebviewMessage, so we should use it directly.
			let webviewMessage: any

			if (
				message.payload !== undefined &&
				message.payload !== null &&
				typeof message.payload === "object" &&
				"type" in (message.payload as Record<string, unknown>)
			) {
				// This is a wrapped message where payload contains the actual message
				webviewMessage = {
					type: message.type,
					...((message.payload as Record<string, unknown>) || {}),
				}
			} else {
				// The WebSocket message IS the WebviewMessage directly.
				// JSON.parse preserves all fields even if they're not in the TypeScript type.
				// We need to pass through the entire raw message.
				webviewMessage = message as any
			}

			this.provider.log(`[WebServer] Processing WebSocket message: ${webviewMessage.type}`)

			// 调用 handler 处理消息
			// 这与 handleCLIMessage 的模式相同
			await this.handler(this.provider, webviewMessage, this.provider["marketplaceManager"])
		} catch (error) {
			this.provider.log(
				`[WebServer] Error handling WebSocket message: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * 将 ExtensionMessage 广播给所有已认证的 WebSocket 客户端
	 * @param message Extension 消息
	 */
	broadcastToClients(message: ExtensionMessage): void {
		const wsMessage: WebSocketMessage = {
			type: message.type,
			payload: message,
		}

		const messageStr = JSON.stringify(wsMessage)
		let sentCount = 0

		for (const client of this.clients) {
			if (client.isAuthenticated && client.readyState === WebSocket.OPEN) {
				try {
					client.send(messageStr)
					sentCount++
				} catch (error) {
					this.provider.log(
						`[WebServer] Error sending to client: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	/**
	 * 新客户端连接时调用
	 * 发送当前状态给新连接的客户端
	 * @param ws 新连接的 WebSocket 客户端
	 */
	async onClientConnect(ws: AuthenticatedWebSocket): Promise<void> {
		this.clients.add(ws)
		this.provider.log(`[WebServer] Client connected. Total clients: ${this.clients.size}`)

		try {
			// kilocode_change: Send initial state as a proper ExtensionMessage.
			// The WebApp.tsx onMessage handler unwraps WebSocketMessage.payload
			// and dispatches it as a MessageEvent. ExtensionStateContext expects
			// the message to be an ExtensionMessage with {type: "state", state: {...}}.
			// So the WebSocketMessage should be {type: "state", payload: {type: "state", state: {...}}}
			// where payload is the ExtensionMessage that gets dispatched to window.
			const state = await this.provider.getStateToPostToWebview()
			const extensionMessage = { type: "state" as const, state }
			const stateMessage: WebSocketMessage = {
				type: "state",
				payload: extensionMessage,
			}

			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(stateMessage))
			}
		} catch (error) {
			this.provider.log(
				`[WebServer] Error sending initial state to client: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * 客户端断开连接时调用
	 * 清理资源
	 * @param ws 断开连接的 WebSocket 客户端
	 */
	onClientDisconnect(ws: AuthenticatedWebSocket): void {
		this.clients.delete(ws)
		this.provider.log(`[WebServer] Client disconnected. Total clients: ${this.clients.size}`)
	}

	/**
	 * 获取当前连接的已认证客户端数量
	 */
	getClientCount(): number {
		return this.clients.size
	}

	/**
	 * 清理所有资源并恢复原始方法
	 */
	dispose(): void {
		// 恢复原始的 postMessageToWebview 方法
		if (this.isPatched && this.originalPostMessageToWebview) {
			this.provider.postMessageToWebview = this.originalPostMessageToWebview
			this.isPatched = false
			this.provider.log("[WebServer] Bridge disposed, postMessageToWebview restored")
		}

		// 关闭所有客户端连接
		for (const client of this.clients) {
			try {
				if (client.readyState === WebSocket.OPEN) {
					client.close(1001, "Server shutting down")
				}
			} catch (error) {
				this.provider.log(
					`[WebServer] Error closing client connection: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		this.clients.clear()
	}
}
