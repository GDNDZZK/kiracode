// kilocode_change - new file

import { describe, it, expect, vi, beforeEach } from "vitest"
import { WebSocket } from "ws"
import { WebServerBridge } from "../bridge"
import type { AuthenticatedWebSocket } from "../types"

// Mock i18next before any imports that use it
vi.mock("i18next", () => ({
	default: {
		init: vi.fn().mockReturnThis(),
		t: vi.fn((key: string) => key),
		use: vi.fn().mockReturnThis(),
	},
}))

// Mock @qdrant/js-client-rest
vi.mock("@qdrant/js-client-rest", () => ({
	QdrantClient: vi.fn().mockImplementation(() => ({})),
}))

// Create a mock handler for dependency injection
const mockHandler = vi.fn().mockResolvedValue(undefined)

// Create a mock provider
function createMockProvider() {
	const originalPostMessage = vi.fn().mockResolvedValue(undefined)
	return {
		postMessageToWebview: originalPostMessage,
		_originalPostMessage: originalPostMessage,
		log: vi.fn(),
		getStateToPostToWebview: vi.fn().mockResolvedValue({ mode: "code", tasks: [] }),
		marketplaceManager: undefined,
	}
}

// Create a mock authenticated WebSocket
function createMockWebSocket(isAuthenticated = true): AuthenticatedWebSocket {
	const ws = {
		isAuthenticated,
		readyState: WebSocket.OPEN,
		send: vi.fn(),
		close: vi.fn(),
	} as unknown as AuthenticatedWebSocket
	return ws
}

describe("WebServerBridge", () => {
	let bridge: WebServerBridge
	let provider: ReturnType<typeof createMockProvider>

	beforeEach(() => {
		vi.clearAllMocks()
		provider = createMockProvider()
		// Use dependency injection to pass the mock handler
		bridge = new WebServerBridge(provider as any, mockHandler as any)
	})

	describe("initialize", () => {
		it("should wrap provider.postMessageToWebview", () => {
			bridge.initialize()

			// The method should be wrapped (not the same reference)
			expect(provider.postMessageToWebview).not.toBe(provider._originalPostMessage)
			expect(provider.log).toHaveBeenCalledWith("[WebServer] Bridge initialized, postMessageToWebview wrapped")
		})

		it("should not double-wrap on repeated calls", () => {
			bridge.initialize()
			const wrapped = provider.postMessageToWebview
			bridge.initialize()

			// Should be the same wrapped function
			expect(provider.postMessageToWebview).toBe(wrapped)
		})
	})

	describe("handleWebSocketMessage", () => {
		it("should ignore messages from unauthenticated clients", async () => {
			const ws = createMockWebSocket(false)
			await bridge.handleWebSocketMessage(ws, { type: "test" })

			expect(provider.log).toHaveBeenCalledWith("[WebServer] Ignoring message from unauthenticated client")
		})

		it("should process messages from authenticated clients", async () => {
			const ws = createMockWebSocket(true)
			const message = { type: "newTask", payload: { text: "Hello" } }

			await bridge.handleWebSocketMessage(ws, message)

			expect(provider.log).toHaveBeenCalledWith("[WebServer] Processing WebSocket message: newTask")
			expect(mockHandler).toHaveBeenCalledWith(
				provider,
				expect.objectContaining({ type: "newTask", text: "Hello" }),
				undefined,
			)
		})

		it("should handle errors gracefully", async () => {
			mockHandler.mockRejectedValueOnce(new Error("Test error"))

			const ws = createMockWebSocket(true)
			await bridge.handleWebSocketMessage(ws, { type: "test" })

			expect(provider.log).toHaveBeenCalledWith("[WebServer] Error handling WebSocket message: Test error")
		})
	})

	describe("broadcastToClients", () => {
		it("should send messages to authenticated clients only", () => {
			const ws1 = createMockWebSocket(true)
			const ws2 = createMockWebSocket(true)
			const ws3 = createMockWebSocket(false) // unauthenticated

			// Add clients via onClientConnect
			bridge.onClientConnect(ws1)
			bridge.onClientConnect(ws2)
			bridge.onClientConnect(ws3)

			bridge.broadcastToClients({ type: "state" as any, state: {} } as any)

			// ws1 and ws2 should receive, ws3 should not (not authenticated)
			expect(ws1.send).toHaveBeenCalledTimes(1)
			expect(ws2.send).toHaveBeenCalledTimes(1)
			expect(ws3.send).toHaveBeenCalledTimes(0)
		})

		it("should wrap ExtensionMessage in WebSocketMessage format", () => {
			const ws = createMockWebSocket(true)
			bridge.onClientConnect(ws)

			const extensionMessage = {
				type: "state" as const,
				state: { apiConfiguration: { apiProvider: "anthropic" } },
			}
			bridge.broadcastToClients(extensionMessage as any)

			expect(ws.send).toHaveBeenCalledTimes(1)
			const sentData = JSON.parse((ws.send as any).mock.calls[0][0])

			// The WebSocketMessage wrapper should have type and payload
			expect(sentData.type).toBe("state")
			expect(sentData.payload).toEqual(extensionMessage)

			// The payload should contain the state with apiConfiguration
			expect(sentData.payload.state.apiConfiguration).toBeDefined()
			expect(sentData.payload.state.apiConfiguration.apiProvider).toBe("anthropic")
		})

		it("should handle send errors gracefully", () => {
			const ws = createMockWebSocket(true)
			ws.send = vi.fn().mockImplementation(() => {
				throw new Error("Send failed")
			})

			bridge.onClientConnect(ws)
			bridge.broadcastToClients({ type: "state" as any } as any)

			expect(provider.log).toHaveBeenCalledWith("[WebServer] Error sending to client: Send failed")
		})
	})

	describe("onClientConnect", () => {
		it("should add client and send initial state", async () => {
			const ws = createMockWebSocket(true)
			await bridge.onClientConnect(ws)

			expect(bridge.getClientCount()).toBe(1)
			expect(provider.getStateToPostToWebview).toHaveBeenCalled()
			expect(ws.send).toHaveBeenCalled()

			const sentData = JSON.parse((ws.send as any).mock.calls[0][0])
			expect(sentData.type).toBe("state")
		})

		it("should handle state retrieval errors gracefully", async () => {
			provider.getStateToPostToWebview.mockRejectedValueOnce(new Error("State error"))
			const ws = createMockWebSocket(true)

			await bridge.onClientConnect(ws)

			expect(bridge.getClientCount()).toBe(1) // Client still added
			expect(provider.log).toHaveBeenCalledWith("[WebServer] Error sending initial state to client: State error")
		})
	})

	describe("onClientDisconnect", () => {
		it("should remove client from set", () => {
			const ws = createMockWebSocket(true)
			bridge.onClientConnect(ws)
			expect(bridge.getClientCount()).toBe(1)

			bridge.onClientDisconnect(ws)
			expect(bridge.getClientCount()).toBe(0)
		})
	})

	describe("dispose", () => {
		it("should restore original postMessageToWebview behavior", () => {
			bridge.initialize()

			// After wrapping, the method is different from original
			expect(provider.postMessageToWebview).not.toBe(provider._originalPostMessage)

			bridge.dispose()

			// After dispose, check the log message was called
			expect(provider.log).toHaveBeenCalledWith("[WebServer] Bridge disposed, postMessageToWebview restored")
		})

		it("should close all client connections", () => {
			const ws1 = createMockWebSocket(true)
			const ws2 = createMockWebSocket(true)

			bridge.onClientConnect(ws1)
			bridge.onClientConnect(ws2)

			bridge.dispose()

			expect(ws1.close).toHaveBeenCalledWith(1001, "Server shutting down")
			expect(ws2.close).toHaveBeenCalledWith(1001, "Server shutting down")
			expect(bridge.getClientCount()).toBe(0)
		})

		it("should handle close errors gracefully", () => {
			const ws = createMockWebSocket(true)
			ws.close = vi.fn().mockImplementation(() => {
				throw new Error("Close failed")
			})

			bridge.onClientConnect(ws)
			bridge.dispose()

			expect(provider.log).toHaveBeenCalledWith("[WebServer] Error closing client connection: Close failed")
		})
	})
})
