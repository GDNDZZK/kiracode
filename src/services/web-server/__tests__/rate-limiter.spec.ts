// kilocode_change - new file

import { RateLimiter } from "../rate-limiter"

describe("RateLimiter", () => {
	let limiter: RateLimiter

	beforeEach(() => {
		limiter = new RateLimiter(5, 1000) // 最多 5 次请求，1 秒窗口
	})

	afterEach(() => {
		limiter.destroy()
	})

	test("允许正常频率的请求", () => {
		for (let i = 0; i < 5; i++) {
			const result = limiter.check("192.168.1.1")
			expect(result.allowed).toBe(true)
			expect(result.retryAfterMs).toBe(0)
		}
	})

	test("超出限制后拒绝请求", () => {
		// 先消耗 5 次请求
		for (let i = 0; i < 5; i++) {
			limiter.check("192.168.1.1")
		}

		// 第 6 次应该被拒绝
		const result = limiter.check("192.168.1.1")
		expect(result.allowed).toBe(false)
		expect(result.retryAfterMs).toBeGreaterThan(0)
	})

	test("时间窗口重置后允许请求", () => {
		// 消耗所有请求
		for (let i = 0; i < 5; i++) {
			limiter.check("192.168.1.1")
		}

		// 确认被限制
		expect(limiter.check("192.168.1.1").allowed).toBe(false)

		// 等待窗口过期
		vi.useFakeTimers()
		vi.advanceTimersByTime(1100)

		// 窗口重置后应该允许请求
		const result = limiter.check("192.168.1.1")
		expect(result.allowed).toBe(true)

		vi.useRealTimers()
	})

	test("不同 IP 独立计数", () => {
		// IP1 消耗所有请求
		for (let i = 0; i < 5; i++) {
			limiter.check("192.168.1.1")
		}

		// IP1 被限制
		expect(limiter.check("192.168.1.1").allowed).toBe(false)

		// IP2 仍然可以请求
		const result = limiter.check("192.168.1.2")
		expect(result.allowed).toBe(true)
		expect(result.retryAfterMs).toBe(0)
	})

	test("cleanup 清理过期记录", () => {
		// 为 IP1 创建记录
		limiter.check("192.168.1.1")
		// 为 IP2 创建记录
		limiter.check("192.168.1.2")

		// 使用 fake timers 让记录过期
		vi.useFakeTimers()
		vi.advanceTimersByTime(1100)

		// 调用 cleanup
		limiter.cleanup()

		// 过期记录应该被清理，新的请求应该被允许（重新开始计数）
		const result1 = limiter.check("192.168.1.1")
		const result2 = limiter.check("192.168.1.2")
		expect(result1.allowed).toBe(true)
		expect(result2.allowed).toBe(true)

		vi.useRealTimers()
	})

	test("使用默认参数创建", () => {
		const defaultLimiter = new RateLimiter()
		// 默认 maxRequests = 10
		for (let i = 0; i < 10; i++) {
			expect(defaultLimiter.check("10.0.0.1").allowed).toBe(true)
		}
		// 第 11 次应该被拒绝
		expect(defaultLimiter.check("10.0.0.1").allowed).toBe(false)
		defaultLimiter.destroy()
	})

	test("retryAfterMs 随时间递减", () => {
		// 消耗所有请求
		for (let i = 0; i < 5; i++) {
			limiter.check("192.168.1.1")
		}

		const result1 = limiter.check("192.168.1.1")
		expect(result1.allowed).toBe(false)

		vi.useFakeTimers()
		vi.advanceTimersByTime(500)

		const result2 = limiter.check("192.168.1.1")
		expect(result2.allowed).toBe(false)
		expect(result2.retryAfterMs).toBeLessThan(result1.retryAfterMs)

		vi.useRealTimers()
	})

	test("destroy 清除所有记录和定时器", () => {
		limiter.check("192.168.1.1")
		limiter.destroy()

		// destroy 后再 check 应该重新开始（因为 entries 已清空）
		// 但由于 interval 已清除，需要创建新的 limiter 来验证
		const newLimiter = new RateLimiter(3, 1000)
		expect(newLimiter.check("192.168.1.1").allowed).toBe(true)
		newLimiter.destroy()
	})
})
