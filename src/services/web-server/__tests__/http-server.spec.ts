// kilocode_change - new file

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import nock from "nock"
import * as http from "http"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { createHttpServer } from "../http-server"
import { generateServerSecret, createSessionToken } from "../auth"
import type { WebServerConfig } from "../types"

// Allow localhost connections for these integration tests
nock.enableNetConnect("localhost")

describe("http-server", () => {
	let server: http.Server
	let port: number
	let serverSecret: string
	const config: WebServerConfig = {
		enabled: true,
		port: 0, // Use random available port
		accessToken: "test-access-token",
	}

	beforeAll(async () => {
		serverSecret = generateServerSecret()
		server = createHttpServer(config, "/nonexistent/path", "/nonexistent/assets", serverSecret, () => {})

		await new Promise<void>((resolve) => {
			server.listen(0, () => {
				const addr = server.address()
				port = typeof addr === "object" && addr ? addr.port : 32141
				resolve()
			})
		})
	})

	afterAll(() => {
		server.close()
	})

	function get(path: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
		return new Promise((resolve, reject) => {
			http.get(`http://localhost:${port}${path}`, (res) => {
				let body = ""
				res.on("data", (chunk) => (body += chunk))
				res.on("end", () => {
					resolve({ statusCode: res.statusCode!, headers: res.headers, body })
				})
			}).on("error", reject)
		})
	}

	function post(
		path: string,
		body: unknown,
	): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
		return new Promise((resolve, reject) => {
			const data = JSON.stringify(body)
			const req = http.request(
				`http://localhost:${port}${path}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": Buffer.byteLength(data),
					},
				},
				(res) => {
					let responseBody = ""
					res.on("data", (chunk) => (responseBody += chunk))
					res.on("end", () => {
						resolve({ statusCode: res.statusCode!, headers: res.headers, body: responseBody })
					})
				},
			)
			req.on("error", reject)
			req.write(data)
			req.end()
		})
	}

	describe("GET /", () => {
		it("should return login page HTML", async () => {
			const res = await get("/")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("text/html")
			expect(res.body).toContain("Kira Code")
			expect(res.body).toContain("access token")
		})

		it("should use localStorage (not sessionStorage) for sessionToken", async () => {
			const res = await get("/")
			expect(res.statusCode).toBe(200)
			// Login page must store token in localStorage to match SPA's getSessionToken()
			expect(res.body).toContain("localStorage.setItem('kilocode_session_token'")
			expect(res.body).not.toContain("sessionStorage.setItem")
		})

		it("should redirect to /app with sessionToken URL parameter", async () => {
			const res = await get("/")
			expect(res.statusCode).toBe(200)
			// Login page must pass sessionToken via URL parameter for SPA to read
			expect(res.body).toContain(
				"window.location.href = '/app?sessionToken=' + encodeURIComponent(data.sessionToken)",
			)
		})
	})

	describe("GET /api/health", () => {
		it("should return health status", async () => {
			const res = await get("/api/health")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("application/json")
			const body = JSON.parse(res.body)
			expect(body.status).toBe("ok")
		})
	})

	describe("POST /api/auth", () => {
		it("should authenticate with valid token", async () => {
			const res = await post("/api/auth", { token: "test-access-token" })
			expect(res.statusCode).toBe(200)
			const body = JSON.parse(res.body)
			expect(body.success).toBe(true)
			expect(body.sessionToken).toBeTruthy()
		})

		it("should reject invalid token", async () => {
			const res = await post("/api/auth", { token: "wrong-token" })
			expect(res.statusCode).toBe(401)
			const body = JSON.parse(res.body)
			expect(body.success).toBe(false)
			expect(body.error).toBeTruthy()
		})

		it("should reject missing token", async () => {
			const res = await post("/api/auth", {})
			expect(res.statusCode).toBe(400)
			const body = JSON.parse(res.body)
			expect(body.success).toBe(false)
		})
	})

	describe("GET /api/status", () => {
		it("should reject unauthenticated request", async () => {
			const res = await get("/api/status")
			expect(res.statusCode).toBe(401)
		})

		it("should return status with valid session token", async () => {
			const sessionToken = createSessionToken(serverSecret)
			const res = await get(`/api/status?sessionToken=${sessionToken}`)
			expect(res.statusCode).toBe(200)
			const body = JSON.parse(res.body)
			expect(body.status).toBe("running")
		})
	})

	describe("Security headers", () => {
		it("should include X-Content-Type-Options header", async () => {
			const res = await get("/api/health")
			expect(res.headers["x-content-type-options"]).toBe("nosniff")
		})

		it("should include X-Frame-Options header", async () => {
			const res = await get("/api/health")
			expect(res.headers["x-frame-options"]).toBe("DENY")
		})

		it("should include Content-Security-Policy header", async () => {
			const res = await get("/api/health")
			expect(res.headers["content-security-policy"]).toBeTruthy()
		})
	})

	describe("404 handling", () => {
		it("should return 404 for unknown API routes", async () => {
			const res = await get("/api/unknown")
			expect(res.statusCode).toBe(404)
		})

		it("should return 404 for POST on unknown routes", async () => {
			const res = await post("/api/unknown", {})
			expect(res.statusCode).toBe(404)
		})
	})

	describe("SPA fallback", () => {
		let spaServer: http.Server
		let spaPort: number
		let tempDir: string

		beforeAll(async () => {
			// 创建临时目录模拟 web 构建产物
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-server-test-"))
			fs.mkdirSync(path.join(tempDir, "assets"))
			fs.writeFileSync(
				path.join(tempDir, "web.html"),
				"<!DOCTYPE html><html><head><title>Kira Code</title></head><body><div id='root'></div></body></html>",
			)
			fs.writeFileSync(path.join(tempDir, "assets", "app.js"), "// app bundle")

			const spaSecret = generateServerSecret()
			spaServer = createHttpServer(config, tempDir, tempDir, spaSecret, () => {})

			await new Promise<void>((resolve) => {
				spaServer.listen(0, () => {
					const addr = spaServer.address()
					spaPort = typeof addr === "object" && addr ? addr.port : 32142
					resolve()
				})
			})
		})

		afterAll(() => {
			spaServer.close()
			fs.rmSync(tempDir, { recursive: true, force: true })
		})

		function spaGet(
			pathname: string,
		): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
			return new Promise((resolve, reject) => {
				http.get(`http://localhost:${spaPort}${pathname}`, (res) => {
					let body = ""
					res.on("data", (chunk) => (body += chunk))
					res.on("end", () => {
						resolve({ statusCode: res.statusCode!, headers: res.headers, body })
					})
				}).on("error", reject)
			})
		}

		it("should fallback to web.html for /app", async () => {
			const res = await spaGet("/app")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("text/html")
			expect(res.body).toContain("Kira Code")
		})

		it("should fallback to web.html for /app/sub/path", async () => {
			const res = await spaGet("/app/sub/path")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("text/html")
			expect(res.body).toContain("Kira Code")
		})

		it("should serve existing static assets", async () => {
			const res = await spaGet("/assets/app.js")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("application/javascript")
			expect(res.body).toContain("app bundle")
		})

		it("should fallback to web.html for any unknown non-API path", async () => {
			const res = await spaGet("/some/random/path")
			expect(res.statusCode).toBe(200)
			expect(res.headers["content-type"]).toContain("text/html")
			expect(res.body).toContain("Kira Code")
		})
	})
})
