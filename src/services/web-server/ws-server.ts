// kilocode_change - new file

import * as http from "http"
import { WebSocketServer, WebSocket } from "ws"
import type { AuthenticatedWebSocket, WebServerConfig, WebSocketMessage } from "./types"
import { validateSessionToken } from "./auth"

/** 心跳间隔（毫秒）：30 秒 */
const HEARTBEAT_INTERVAL = 30_000

/** 心跳超时（毫秒）：60 秒无 pong 响应则断开 */
const HEARTBEAT_TIMEOUT = 60_000

/**
 * 创建 WebSocket 服务器
 * @param httpServer HTTP 服务器实例
 * @param config Web Server 配置
 * @param serverSecret 服务器端密钥（用于验证会话令牌）
 * @param log 日志函数
 * @returns WebSocket.Server 实例
 */
export function createWebSocketServer(
	httpServer: http.Server,
	config: WebServerConfig,
	serverSecret: string,
	log: (message: string) => void,
): WebSocketServer {
	const wss = new WebSocketServer({ server: httpServer, path: "/ws" })

	// 心跳定时器
	const heartbeatTimer = setInterval(() => {
		wss.clients.forEach((client) => {
			const ws = client as AuthenticatedWebSocket

			// 检查是否超时未响应 pong
			if (ws.isAuthenticated && !(ws as { isAlive?: boolean }).isAlive) {
				log("[WebServer] WebSocket heartbeat timeout, terminating connection")
				return ws.terminate()
			}

			// 标记为未响应，等待下次 pong
			;(ws as { isAlive?: boolean }).isAlive = false
			ws.ping()
		})
	}, HEARTBEAT_INTERVAL)

	// 清理心跳定时器
	wss.on("close", () => {
		clearInterval(heartbeatTimer)
	})

	wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
		const authedWs = ws as AuthenticatedWebSocket
		authedWs.isAuthenticated = false

		// 从 HTTP 请求的 URL 查询参数中提取 sessionToken
		// 注意：ws 库的 WebSocket 对象没有 url 属性，URL 信息在 req.url 中
		const requestUrl = req.url || ""
		let sessionToken: string | null = null

		try {
			const urlObj = new URL(requestUrl, "ws://localhost")
			sessionToken = urlObj.searchParams.get("sessionToken")
		} catch {
			// URL 解析失败
		}

		// 验证会话令牌
		if (!sessionToken || !validateSessionToken(sessionToken, serverSecret)) {
			log(
				`[WebServer] WebSocket connection rejected: authentication failed (sessionToken=${sessionToken ? "present" : "missing"}, url=${requestUrl})`,
			) // kilocode_change: add debug logging
			ws.close(4001, "Authentication failed")
			return
		}

		// 认证成功
		authedWs.isAuthenticated = true
		;(authedWs as { isAlive?: boolean }).isAlive = true
		log("[WebServer] WebSocket client authenticated and connected")

		// 转发连接事件
		wss.emit("clientConnected", authedWs)

		// pong 响应处理
		ws.on("pong", () => {
			;(authedWs as { isAlive?: boolean }).isAlive = true
		})

		// 消息处理
		ws.on("message", (data: Buffer, isBinary: boolean) => {
			if (!authedWs.isAuthenticated) {
				log("[WebServer] Received message from unauthenticated WebSocket, closing")
				ws.close(4001, "Not authenticated")
				return
			}

			try {
				const messageStr = isBinary ? data.toString("utf-8") : data.toString("utf-8")
				const message: WebSocketMessage = JSON.parse(messageStr)
				log(`[WebServer] WebSocket message received: ${message.type}`)

				// 转发消息事件
				wss.emit("clientMessage", authedWs, message)
			} catch (error) {
				log(
					`[WebServer] Error parsing WebSocket message: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		})

		// 关闭处理
		ws.on("close", (code: number, reason: Buffer) => {
			log(`[WebServer] WebSocket client disconnected (code: ${code})`)
			wss.emit("clientDisconnected", authedWs, code, reason)
		})

		// 错误处理
		ws.on("error", (error: Error) => {
			log(`[WebServer] WebSocket error: ${error.message}`)
			wss.emit("clientError", authedWs, error)
		})
	})

	return wss
}

/**
 * 向所有已认证的 WebSocket 客户端广播消息
 * @param wss WebSocket 服务器实例
 * @param message 要广播的消息
 * @param log 日志函数
 */
export function broadcastToClients(
	wss: WebSocketServer,
	message: WebSocketMessage,
	log: (message: string) => void,
): void {
	const messageStr = JSON.stringify(message)
	let sentCount = 0

	wss.clients.forEach((client) => {
		const ws = client as AuthenticatedWebSocket

		if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
			ws.send(messageStr)
			sentCount++
		}
	})

	log(`[WebServer] Broadcast message "${message.type}" to ${sentCount} client(s)`)
}

/**
 * 获取所有已认证的 WebSocket 客户端
 * @param wss WebSocket 服务器实例
 * @returns 已认证的 WebSocket 连接数组
 */
export function getAuthenticatedClients(wss: WebSocketServer): AuthenticatedWebSocket[] {
	const clients: AuthenticatedWebSocket[] = []

	wss.clients.forEach((client) => {
		const ws = client as AuthenticatedWebSocket
		if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
			clients.push(ws)
		}
	})

	return clients
}
