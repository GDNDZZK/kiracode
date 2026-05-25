// kilocode_change - new file

interface RateLimitEntry {
	count: number
	resetTime: number
}

interface RateLimitResult {
	allowed: boolean
	retryAfterMs: number
}

/**
 * 基于 IP 的简单速率限制器
 * 使用 Map 存储每个 IP 的请求计数和重置时间
 */
export class RateLimiter {
	private entries = new Map<string, RateLimitEntry>()
	private readonly maxRequests: number
	private readonly windowMs: number
	private cleanupInterval: ReturnType<typeof setInterval> | null = null

	constructor(maxRequests = 10, windowMs = 60000) {
		this.maxRequests = maxRequests
		this.windowMs = windowMs
		// 每 5 分钟清理一次过期记录
		this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
	}

	/**
	 * 检查指定 IP 是否允许请求
	 * @param ip 客户端 IP 地址
	 * @returns 是否允许请求及需要等待的毫秒数
	 */
	check(ip: string): RateLimitResult {
		const now = Date.now()
		const entry = this.entries.get(ip)

		if (!entry || now >= entry.resetTime) {
			// 新窗口或窗口已过期，重置计数
			this.entries.set(ip, {
				count: 1,
				resetTime: now + this.windowMs,
			})
			return { allowed: true, retryAfterMs: 0 }
		}

		if (entry.count >= this.maxRequests) {
			// 超出限制
			const retryAfterMs = entry.resetTime - now
			return { allowed: false, retryAfterMs }
		}

		// 增加计数
		entry.count++
		return { allowed: true, retryAfterMs: 0 }
	}

	/**
	 * 清理所有过期的限制记录
	 */
	cleanup(): void {
		const now = Date.now()
		for (const [ip, entry] of this.entries) {
			if (now >= entry.resetTime) {
				this.entries.delete(ip)
			}
		}
	}

	/**
	 * 停止自动清理并清除所有记录
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}
		this.entries.clear()
	}
}
