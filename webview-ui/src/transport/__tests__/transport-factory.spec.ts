// kilocode_change - new file

import { createTransport, createWebTransport, isVSCodeEnvironment, isWebEnvironment } from "../index"
import { getSessionToken, setSessionToken, clearSessionToken } from "../web-transport"

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

// Mock WebSocket for WebTransport
class MockWebSocket {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3

	readyState = MockWebSocket.CONNECTING
	url = ""
	onopen: (() => void) | null = null
	onclose: ((event: { code: number; reason: string }) => void) | null = null
	onmessage: ((event: { data: string }) => void) | null = null
	onerror: ((event: Event) => void) | null = null

	constructor(url: string) {
		this.url = url
	}

	send(_data: string): void {}
	close(): void {
		this.readyState = MockWebSocket.CLOSED
	}
}

describe("Transport Factory", () => {
	let originalAcquireVsCodeApi: typeof window.acquireVsCodeApi

	beforeEach(() => {
		localStorageMock.clear()
		vi.stubGlobal("localStorage", localStorageMock)
		vi.stubGlobal("WebSocket", MockWebSocket)

		// Save original
		originalAcquireVsCodeApi = window.acquireVsCodeApi

		// Mock window.location
		Object.defineProperty(window, "location", {
			value: {
				protocol: "http:",
				host: "localhost:3000",
			},
			writable: true,
			configurable: true,
		})
	})

	afterEach(() => {
		// Restore original acquireVsCodeApi
		if (originalAcquireVsCodeApi !== undefined) {
			window.acquireVsCodeApi = originalAcquireVsCodeApi
		} else {
			delete (window as any).acquireVsCodeApi
		}
		vi.restoreAllMocks()
	})

	describe("isVSCodeEnvironment", () => {
		test("returns true when acquireVsCodeApi exists", () => {
			;(window as any).acquireVsCodeApi = () => ({})
			expect(isVSCodeEnvironment()).toBe(true)
		})

		test("returns false when acquireVsCodeApi does not exist", () => {
			delete (window as any).acquireVsCodeApi
			expect(isVSCodeEnvironment()).toBe(false)
		})
	})

	describe("isWebEnvironment", () => {
		test("returns true when acquireVsCodeApi does not exist", () => {
			delete (window as any).acquireVsCodeApi
			expect(isWebEnvironment()).toBe(true)
		})

		test("returns false when acquireVsCodeApi exists", () => {
			;(window as any).acquireVsCodeApi = () => ({})
			expect(isWebEnvironment()).toBe(false)
		})
	})

	describe("createTransport", () => {
		test("returns null in web environment without token", () => {
			delete (window as any).acquireVsCodeApi
			expect(createTransport()).toBeNull()
		})

		test("returns WebTransport in web environment with token", () => {
			delete (window as any).acquireVsCodeApi
			setSessionToken("test-token")

			const transport = createTransport()
			expect(transport).toBeTruthy()
			expect(transport!.postMessage).toBeDefined()
			expect(transport!.onMessage).toBeDefined()
			transport!.dispose()
		})

		test("returns VSCodeTransport in VS Code environment", () => {
			;(window as any).acquireVsCodeApi = () => ({
				postMessage: () => {},
				getState: () => undefined,
				setState: () => {},
			})

			const transport = createTransport()
			expect(transport).toBeTruthy()
			expect(transport!.postMessage).toBeDefined()
		})
	})

	describe("createWebTransport", () => {
		test("creates WebTransport with explicit token", () => {
			const transport = createWebTransport("explicit-token")
			expect(transport).toBeTruthy()
			expect(transport.isConnected).toBe(false)
			transport.dispose()
		})
	})

	describe("session token utilities", () => {
		test("getSessionToken returns null when not set", () => {
			expect(getSessionToken()).toBeNull()
		})

		test("setSessionToken and getSessionToken work together", () => {
			setSessionToken("test-token")
			expect(getSessionToken()).toBe("test-token")
		})

		test("clearSessionToken removes the token", () => {
			setSessionToken("test-token")
			clearSessionToken()
			expect(getSessionToken()).toBeNull()
		})
	})
})
