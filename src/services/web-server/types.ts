// kilocode_change - new file

import { WebSocket } from "ws"

/**
 * Web Server 配置接口
 */
export interface WebServerConfig {
	/** 是否启用 Web Server（默认 false） */
	enabled: boolean
	/** 端口号（默认 22141） */
	port: number
	/** 访问密钥（用户自定义） */
	accessToken: string
}

/**
 * Web Server 运行状态接口
 */
export interface WebServerStatus {
	/** 是否正在运行 */
	running: boolean
	/** 当前监听的端口号 */
	port?: number
	/** 错误信息 */
	error?: string
}

/**
 * WebSocket 消息格式
 */
export interface WebSocketMessage {
	/** 消息类型 */
	type: string
	/** 消息负载 */
	payload?: unknown
}

/**
 * 扩展 WebSocket 类型，携带认证状态
 */
export interface AuthenticatedWebSocket extends WebSocket {
	/** 是否已通过认证 */
	isAuthenticated: boolean
}
