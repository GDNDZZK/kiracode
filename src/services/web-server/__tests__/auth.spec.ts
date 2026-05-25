// kilocode_change - new file

import { describe, it, expect, vi } from "vitest"
import {
	validateToken,
	generateServerSecret,
	createSessionToken,
	validateSessionToken,
	authenticateWebSocket,
} from "../auth"
import type { WebServerConfig, AuthenticatedWebSocket } from "../types"

describe("auth", () => {
	describe("validateToken", () => {
		it("should return true for matching tokens", () => {
			const token = "my-secret-token"
			expect(validateToken(token, token)).toBe(true)
		})

		it("should return false for non-matching tokens", () => {
			expect(validateToken("wrong-token", "correct-token")).toBe(false)
		})

		it("should return false for empty input token", () => {
			expect(validateToken("", "correct-token")).toBe(false)
		})

		it("should return false for empty config token", () => {
			expect(validateToken("some-token", "")).toBe(false)
		})

		it("should return false for both empty tokens", () => {
			expect(validateToken("", "")).toBe(false)
		})

		it("should handle unicode tokens", () => {
			const token = "密钥-🔑-token"
			expect(validateToken(token, token)).toBe(true)
		})
	})

	describe("generateServerSecret", () => {
		it("should generate a non-empty string", () => {
			const secret = generateServerSecret()
			expect(secret).toBeTruthy()
			expect(typeof secret).toBe("string")
		})

		it("should generate unique secrets", () => {
			const secret1 = generateServerSecret()
			const secret2 = generateServerSecret()
			expect(secret1).not.toBe(secret2)
		})

		it("should generate a 128-character hex string (64 bytes)", () => {
			const secret = generateServerSecret()
			expect(secret).toMatch(/^[0-9a-f]{128}$/)
		})
	})

	describe("createSessionToken and validateSessionToken", () => {
		it("should create and validate a session token", () => {
			const secret = generateServerSecret()
			const token = createSessionToken(secret)
			expect(validateSessionToken(token, secret)).toBe(true)
		})

		it("should reject token with wrong secret", () => {
			const secret1 = generateServerSecret()
			const secret2 = generateServerSecret()
			const token = createSessionToken(secret1)
			expect(validateSessionToken(token, secret2)).toBe(false)
		})

		it("should reject empty token", () => {
			const secret = generateServerSecret()
			expect(validateSessionToken("", secret)).toBe(false)
		})

		it("should reject empty secret", () => {
			const secret = generateServerSecret()
			const token = createSessionToken(secret)
			expect(validateSessionToken(token, "")).toBe(false)
		})

		it("should reject malformed token with wrong number of parts", () => {
			const secret = generateServerSecret()
			expect(validateSessionToken("only.two", secret)).toBe(false)
			expect(validateSessionToken("one", secret)).toBe(false)
		})

		it("should reject tampered token", () => {
			const secret = generateServerSecret()
			const token = createSessionToken(secret)
			const parts = token.split(".")
			// Tamper with the signature
			parts[2] = "tampered_signature"
			const tamperedToken = parts.join(".")
			expect(validateSessionToken(tamperedToken, secret)).toBe(false)
		})
	})

	describe("authenticateWebSocket", () => {
		it("should authenticate with valid sessionToken", () => {
			const config: WebServerConfig = {
				enabled: true,
				port: 22141,
				accessToken: "test-token",
			}

			const ws = {
				isAuthenticated: false,
			} as AuthenticatedWebSocket

			const req = { url: "/ws?sessionToken=test-token" }
			const result = authenticateWebSocket(ws, req, config)
			expect(result).toBe(true)
			expect(ws.isAuthenticated).toBe(true)
		})

		it("should reject with invalid sessionToken", () => {
			const config: WebServerConfig = {
				enabled: true,
				port: 22141,
				accessToken: "correct-token",
			}

			const ws = {
				isAuthenticated: false,
			} as AuthenticatedWebSocket

			const req = { url: "/ws?sessionToken=wrong-token" }
			const result = authenticateWebSocket(ws, req, config)
			expect(result).toBe(false)
			expect(ws.isAuthenticated).toBe(false)
		})

		it("should reject when no sessionToken provided", () => {
			const config: WebServerConfig = {
				enabled: true,
				port: 22141,
				accessToken: "test-token",
			}

			const ws = {
				isAuthenticated: false,
			} as AuthenticatedWebSocket

			const req = { url: "/ws" }
			const result = authenticateWebSocket(ws, req, config)
			expect(result).toBe(false)
			expect(ws.isAuthenticated).toBe(false)
		})

		it("should handle empty URL", () => {
			const config: WebServerConfig = {
				enabled: true,
				port: 22141,
				accessToken: "test-token",
			}

			const ws = {
				isAuthenticated: false,
			} as AuthenticatedWebSocket

			const req = { url: "" }
			const result = authenticateWebSocket(ws, req, config)
			expect(result).toBe(false)
			expect(ws.isAuthenticated).toBe(false)
		})

		it("should not authenticate with old 'token' parameter name", () => {
			const config: WebServerConfig = {
				enabled: true,
				port: 22141,
				accessToken: "test-token",
			}

			const ws = {
				isAuthenticated: false,
			} as AuthenticatedWebSocket

			// 使用旧的 'token' 参数名应该失败，因为现在只识别 'sessionToken'
			const req = { url: "/ws?token=test-token" }
			const result = authenticateWebSocket(ws, req, config)
			expect(result).toBe(false)
			expect(ws.isAuthenticated).toBe(false)
		})
	})
})
