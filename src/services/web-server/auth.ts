// kilocode_change - new file

import * as crypto from "crypto"
import type { AuthenticatedWebSocket, WebServerConfig } from "./types"

/**
 * 使用时间安全的字符串比较验证 token，防止时序攻击
 * @param inputToken 用户提供的 token
 * @param configToken 配置中存储的 token
 * @returns 是否匹配
 */
export function validateToken(inputToken: string, configToken: string): boolean {
	if (!inputToken || !configToken) {
		return false
	}

	// 将字符串转换为 Buffer 进行时间安全比较
	const inputBuffer = Buffer.from(inputToken, "utf-8")
	const configBuffer = Buffer.from(configToken, "utf-8")

	// timingSafeEqual 要求 buffer 长度相同
	// 长度不同时，将较短的 buffer 填充到相同长度再比较，防止时序泄露
	if (inputBuffer.length !== configBuffer.length) {
		const maxLength = Math.max(inputBuffer.length, configBuffer.length)
		const paddedInput = Buffer.alloc(maxLength)
		const paddedConfig = Buffer.alloc(maxLength)
		inputBuffer.copy(paddedInput)
		configBuffer.copy(paddedConfig)
		return crypto.timingSafeEqual(paddedInput, paddedConfig) && inputBuffer.length === configBuffer.length
	}

	return crypto.timingSafeEqual(inputBuffer, configBuffer)
}

/**
 * 生成服务器端密钥用于 JWT 签名
 * @returns 64 字节的十六进制随机字符串
 */
export function generateServerSecret(): string {
	return crypto.randomBytes(64).toString("hex")
}

/**
 * 使用 HMAC-SHA256 创建会话令牌
 * @param serverSecret 服务器端密钥
 * @returns 会话令牌字符串
 */
export function createSessionToken(serverSecret: string): string {
	const timestamp = Date.now().toString(36)
	const randomPart = crypto.randomBytes(16).toString("hex")
	const payload = `${timestamp}.${randomPart}`

	const hmac = crypto.createHmac("sha256", serverSecret)
	hmac.update(payload)
	const signature = hmac.digest("hex")

	return `${payload}.${signature}`
}

/** 会话令牌最大有效期：24 小时 */
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000

/**
 * 验证会话令牌
 * @param token 待验证的会话令牌
 * @param serverSecret 服务器端密钥
 * @returns 是否有效
 */
export function validateSessionToken(token: string, serverSecret: string): boolean {
	if (!token || !serverSecret) {
		return false
	}

	const parts = token.split(".")
	if (parts.length !== 3) {
		return false
	}

	const [timestamp, randomPart, signature] = parts

	// 检查令牌是否过期
	const tokenTime = parseInt(timestamp, 36)
	if (isNaN(tokenTime) || Date.now() - tokenTime > MAX_SESSION_AGE_MS) {
		return false
	}

	const payload = `${timestamp}.${randomPart}`

	// 重新计算签名
	const hmac = crypto.createHmac("sha256", serverSecret)
	hmac.update(payload)
	const expectedSignature = hmac.digest("hex")

	// 使用时间安全比较验证签名
	try {
		const signatureBuffer = Buffer.from(signature, "utf-8")
		const expectedBuffer = Buffer.from(expectedSignature, "utf-8")

		if (signatureBuffer.length !== expectedBuffer.length) {
			return false
		}

		return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
	} catch {
		return false
	}
}

/**
 * 从 WebSocket 升级请求的 URL 查询参数中提取 sessionToken 并验证
 * 注意：ws 库的 WebSocket 对象没有 url 属性，URL 信息在 req.url 中
 * @param ws WebSocket 连接
 * @param req HTTP 升级请求（包含请求 URL）
 * @param config Web Server 配置
 * @returns 是否认证成功
 */
export function authenticateWebSocket(
	ws: AuthenticatedWebSocket,
	req: { url?: string },
	config: WebServerConfig,
): boolean {
	const url = req.url || ""

	try {
		const urlObj = new URL(url, "ws://localhost")
		const token = urlObj.searchParams.get("sessionToken") // kilocode_change: 修复参数名从 token 改为 sessionToken

		if (!token) {
			ws.isAuthenticated = false
			return false
		}

		const isValid = validateToken(token, config.accessToken)
		ws.isAuthenticated = isValid
		return isValid
	} catch {
		ws.isAuthenticated = false
		return false
	}
}
