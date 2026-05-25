// kilocode_change - new file

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import nock from "nock"
import * as http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { createWebSocketServer, getAuthenticatedClients } from "../ws-server"
import { generateServerSecret, createSessionToken } from "../auth"
import type { WebServerConfig } from "../types"

// Allow localhost connections for these integration tests
nock.enableNetConnect("localhost")

describe("ws-server", () => {
	let httpServer: http.Server
	let port: number
	let serverSecret: string
	const config: WebServerConfig = {
		enabled: true,
		port: 0,
		accessToken: "test-access-token",
	}
	const log = () => {}

	beforeAll(async () => {
		serverSecret = generateServerSecret()
		httpServer = http.createServer()

		await new Promise<void>((resolve) => {
			httpServer.listen(0, () => {
				const addr = httpServer.address()
				port = typeof addr === "object" && addr ? addr.port : 32142
				resolve()
			})
		})

		createWebSocketServer(httpServer, config, serverSecret, log)
	})

	afterAll(() => {
		httpServer.close()
	})

	function connectWs(sessionToken: string): Promise<WebSocket> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(`ws://localhost:${port}/ws?sessionToken=${sessionToken}`)
			const timeout = setTimeout(() => {
				ws.close()
				reject(new Error("Connection timeout"))
			}, 5000)

			ws.on("open", () => {
				clearTimeout(timeout)
				resolve(ws)
			})

			ws.on("error", (err) => {
				clearTimeout(timeout)
				reject(err)
			})
		})
	}

	describe("authentication", () => {
		it("should reject connection without sessionToken", async () => {
			const ws = new WebSocket(`ws://localhost:${port}/ws`)

			const closeCode = await new Promise<number>((resolve) => {
				ws.on("close", (code) => resolve(code))
			})

			expect(closeCode).toBe(4001)
		})

		it("should reject connection with invalid sessionToken", async () => {
			const ws = new WebSocket(`ws://localhost:${port}/ws?sessionToken=invalid-token`)

			const closeCode = await new Promise<number>((resolve) => {
				ws.on("close", (code) => resolve(code))
			})

			expect(closeCode).toBe(4001)
		})

		it("should accept connection with valid sessionToken", async () => {
			const sessionToken = createSessionToken(serverSecret)
			const ws = await connectWs(sessionToken)
			expect(ws.readyState).toBe(WebSocket.OPEN)
			ws.close()
		})
	})

	describe("getAuthenticatedClients", () => {
		it("should return empty array when no clients connected", () => {
			const testHttp = http.createServer()
			const testWss = new WebSocketServer({ server: testHttp })

			const clients = getAuthenticatedClients(testWss)
			expect(clients).toEqual([])

			testWss.close()
			testHttp.close()
		})
	})
})
