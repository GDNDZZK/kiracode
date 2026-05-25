// kilocode_change - new file

import { WebTransport, getSessionToken, setSessionToken, clearSessionToken } from "../web-transport"

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3

	readyState = MockWebSocket.CONNECTING
	url: string
	onopen: (() => void) | null = null
	onclose: ((event: { code: number; reason: string }) => void) | null = null
	onmessage: ((event: { data: string }) => void) | null = null
	onerror: ((event: Event) => void) | null = null

	constructor(url: string) {
		this.url = url
		// Store reference for testing
		MockWebSocket.lastInstance = this
	}

	send(data: string): void {
		MockWebSocket.sentMessages.push(data)
	}

	close(): void {
		this.readyState = MockWebSocket.CLOSED
	}

	// Test helpers
	simulateOpen(): void {
		this.readyState = MockWebSocket.OPEN
		this.onopen?.()
	}

	simulateMessage(data: any): void {
		this.onmessage?.({ data: JSON.stringify(data) })
	}

	simulateClose(code = 1000, reason = ""): void {
		this.readyState = MockWebSocket.CLOSED
		this.onclose?.({ code, reason })
	}

	simulateError(): void {
		this.onerror?.(new Event("error"))
	}

	static lastInstance: MockWebSocket | null = null
	static sentMessages: string[] = []

	static reset(): void {
		MockWebSocket.lastInstance = null
		MockWebSocket.sentMessages = []
	}
}

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {}
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value
		},
		removeItem: (key: string) => {
			delete store[key]
		},
		clear: () => {
			store = {}
		},
	}
})()

describe("WebTransport", () => {
	beforeEach(() => {
		MockWebSocket.reset()
		localStorageMock.clear()
		vi.useFakeTimers()

		// Mock global WebSocket
		vi.stubGlobal("WebSocket", MockWebSocket)
		vi.stubGlobal("localStorage", localStorageMock)

		// Mock window.location
		Object.defineProperty(window, "location", {
			value: {
				protocol: "http:",
				host: "localhost:3000",
			},
			writable: true,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe("constructor", () => {
		test("creates WebSocket connection with token", () => {
			const transport = new WebTransport("test-token")
			expect(MockWebSocket.lastInstance).toBeTruthy()
			expect(MockWebSocket.lastInstance!.url).toBe("ws://localhost:3000/ws?sessionToken=test-token")
			transport.dispose()
		})

		test("uses wss protocol for https", () => {
			Object.defineProperty(window, "location", {
				value: {
					protocol: "https:",
					host: "example.com",
				},
				writable: true,
			})

			const transport = new WebTransport("secure-token")
			expect(MockWebSocket.lastInstance!.url).toBe("wss://example.com/ws?sessionToken=secure-token")
			transport.dispose()
		})

		test("encodes token in URL", () => {
			const transport = new WebTransport("token with spaces")
			expect(MockWebSocket.lastInstance!.url).toBe("ws://localhost:3000/ws?sessionToken=token%20with%20spaces")
			transport.dispose()
		})
	})

	describe("postMessage", () => {
		test("sends message when WebSocket is open", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			transport.postMessage({ type: "test", data: "hello" })

			expect(MockWebSocket.sentMessages).toHaveLength(1)
			expect(JSON.parse(MockWebSocket.sentMessages[0])).toEqual({ type: "test", data: "hello" })
			transport.dispose()
		})

		test("does not send when WebSocket is not open", () => {
			const transport = new WebTransport("test-token")
			// WebSocket is in CONNECTING state by default

			transport.postMessage({ type: "test" })

			expect(MockWebSocket.sentMessages).toHaveLength(0)
			transport.dispose()
		})
	})

	describe("onMessage", () => {
		test("receives messages from WebSocket", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			const received: any[] = []
			transport.onMessage((msg) => received.push(msg))

			ws.simulateMessage({ type: "response", data: "world" })

			expect(received).toHaveLength(1)
			expect(received[0]).toEqual({ type: "response", data: "world" })
			transport.dispose()
		})

		test("unsubscribe stops receiving messages", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			const received: any[] = []
			const unsubscribe = transport.onMessage((msg) => received.push(msg))

			unsubscribe()
			ws.simulateMessage({ type: "response" })

			expect(received).toHaveLength(0)
			transport.dispose()
		})

		test("ignores pong messages", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			const received: any[] = []
			transport.onMessage((msg) => received.push(msg))

			ws.simulateMessage({ type: "pong" })

			expect(received).toHaveLength(0)
			transport.dispose()
		})
	})

	describe("getState / setState", () => {
		test("persists state to localStorage", async () => {
			const transport = new WebTransport("test-token")

			await transport.setState({ key: "value" })
			const state = await transport.getState()

			expect(state).toEqual({ key: "value" })
			transport.dispose()
		})

		test("returns undefined when no state exists", async () => {
			const transport = new WebTransport("test-token")

			const state = await transport.getState()

			expect(state).toBeUndefined()
			transport.dispose()
		})
	})

	describe("isConnected", () => {
		test("returns true when WebSocket is open", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			expect(transport.isConnected).toBe(true)
			transport.dispose()
		})

		test("returns false when WebSocket is not open", () => {
			const transport = new WebTransport("test-token")

			expect(transport.isConnected).toBe(false)
			transport.dispose()
		})
	})

	describe("reconnection", () => {
		test("attempts to reconnect on close", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!

			ws.simulateClose()

			// Advance timers to trigger reconnect
			vi.advanceTimersByTime(3000)

			// A new WebSocket should have been created
			expect(MockWebSocket.lastInstance).toBeTruthy()
			transport.dispose()
		})

		test("stops reconnecting after max attempts", () => {
			const transport = new WebTransport("test-token")

			// Simulate 5 reconnection attempts
			for (let i = 0; i < 5; i++) {
				const ws = MockWebSocket.lastInstance!
				ws.simulateClose()
				vi.advanceTimersByTime(60000) // Long enough for any backoff
			}

			// The 6th close should not trigger another reconnect
			const instanceBeforeSixth = MockWebSocket.lastInstance
			const ws = MockWebSocket.lastInstance!
			ws.simulateClose()
			vi.advanceTimersByTime(60000)

			expect(MockWebSocket.lastInstance).toBe(instanceBeforeSixth)
			transport.dispose()
		})

		test("does not reconnect after dispose", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!

			transport.dispose()
			ws.simulateClose()

			vi.advanceTimersByTime(60000)

			// No new WebSocket should be created
			expect(MockWebSocket.lastInstance).toBe(ws)
		})
	})

	describe("heartbeat", () => {
		test("sends ping after connection", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			// Advance past heartbeat interval
			vi.advanceTimersByTime(30000)

			expect(MockWebSocket.sentMessages).toHaveLength(1)
			expect(JSON.parse(MockWebSocket.sentMessages[0])).toEqual({ type: "ping" })
			transport.dispose()
		})
	})

	describe("dispose", () => {
		test("cleans up resources", () => {
			const transport = new WebTransport("test-token")
			const ws = MockWebSocket.lastInstance!
			ws.simulateOpen()

			const received: any[] = []
			transport.onMessage((msg) => received.push(msg))

			transport.dispose()

			// WebSocket should be closed
			expect(ws.readyState).toBe(MockWebSocket.CLOSED)
			// Callbacks should be cleared - simulate a message
			ws.simulateMessage({ type: "test" })
			expect(received).toHaveLength(0)
		})
	})
})

describe("Session token utilities", () => {
	beforeEach(() => {
		localStorageMock.clear()
		vi.stubGlobal("localStorage", localStorageMock)
	})

	test("getSessionToken returns null when no token", () => {
		expect(getSessionToken()).toBeNull()
	})

	test("setSessionToken stores token", () => {
		setSessionToken("my-token")
		expect(getSessionToken()).toBe("my-token")
	})

	test("clearSessionToken removes token", () => {
		setSessionToken("my-token")
		clearSessionToken()
		expect(getSessionToken()).toBeNull()
	})
})
