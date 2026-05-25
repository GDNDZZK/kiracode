// kilocode_change - new file

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import React from "react"

// Must use factory functions that return mock implementations directly
// because vi.mock is hoisted and variable assignments haven't run yet
vi.mock("@/transport", () => ({
	createWebTransport: vi.fn(),
	setSessionToken: vi.fn(),
	getSessionToken: vi.fn(() => null),
	clearSessionToken: vi.fn(),
	isVSCodeEnvironment: vi.fn(() => false),
	Transport: {},
}))

vi.mock("@/utils/vscode", () => ({
	setWebTransport: vi.fn(),
}))

vi.mock("@/App", () => ({
	default: () => React.createElement("div", { "data-testid": "main-app" }, "Main App"),
}))

import WebApp from "../WebApp"
import { createWebTransport, setSessionToken, getSessionToken, isVSCodeEnvironment } from "@/transport"

function createMockTransport(connected = false) {
	return {
		isConnected: connected,
		onMessage: vi.fn(() => vi.fn()),
		postMessage: vi.fn(),
		dispose: vi.fn(),
		getState: vi.fn().mockResolvedValue(undefined),
		setState: vi.fn().mockResolvedValue(undefined),
	}
}

describe("WebApp", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset default mock returns
		;(isVSCodeEnvironment as ReturnType<typeof vi.fn>).mockReturnValue(false)
		;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue(null)
		// Reset URL to clean state
		window.history.pushState({}, "", "/app")
	})

	afterEach(() => {
		// Clean up URL
		window.history.pushState({}, "", "/app")
	})

	describe("sessionToken from URL parameter", () => {
		test("reads sessionToken from URL search params and stores to localStorage", async () => {
			// Set URL with sessionToken parameter
			window.history.pushState({}, "", "/app?sessionToken=test-url-token-123")

			const mockTransport = createMockTransport(true)
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			const replaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {})

			render(React.createElement(WebApp))

			// The useEffect should have read the URL token and called setSessionToken
			// and createWebTransport via connectWithToken
			await waitFor(() => {
				expect(setSessionToken).toHaveBeenCalledWith("test-url-token-123")
			})
			expect(createWebTransport).toHaveBeenCalledWith("test-url-token-123")
			expect(replaceStateSpy).toHaveBeenCalled()

			replaceStateSpy.mockRestore()
		})

		test("prefers URL token over localStorage token", async () => {
			window.history.pushState({}, "", "/app?sessionToken=url-token")
			;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue("local-storage-token")

			const mockTransport = createMockTransport(true)
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			vi.spyOn(window.history, "replaceState").mockImplementation(() => {})

			render(React.createElement(WebApp))

			await waitFor(() => {
				expect(createWebTransport).toHaveBeenCalledWith("url-token")
			})
			expect(setSessionToken).toHaveBeenCalledWith("url-token")
			// Should NOT call getSessionToken since URL token was found first
			expect(getSessionToken).not.toHaveBeenCalled()
		})
	})

	describe("sessionToken from localStorage", () => {
		test("falls back to localStorage when no URL parameter", async () => {
			// URL is clean (set in beforeEach)
			;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue("stored-token-456")

			const mockTransport = createMockTransport(true)
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			render(React.createElement(WebApp))

			await waitFor(() => {
				expect(createWebTransport).toHaveBeenCalledWith("stored-token-456")
			})
		})

		test("transitions to connected state when WebSocket connects", async () => {
			;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue("stored-token")

			// Start with connected transport (simulates immediate connection)
			const mockTransport = createMockTransport(true)
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			render(React.createElement(WebApp))

			// Should eventually show the main app (connected state)
			// The setInterval in connectWithToken checks isConnected every 100ms
			await waitFor(
				() => {
					expect(screen.getByTestId("main-app")).toBeTruthy()
				},
				{ timeout: 3000 },
			)
		})
	})

	describe("no sessionToken available", () => {
		test("shows login page when no token in URL or localStorage", async () => {
			// URL is clean (set in beforeEach), no localStorage token (default mock returns null)
			render(React.createElement(WebApp))

			// Wait for useEffect to run and determine no token is available
			// The component should show the login page (disconnected state)
			await waitFor(() => {
				// LoginPage should be rendered - check for the "Connect" button
				const connectButton = screen.getByRole("button", { name: /connect/i })
				expect(connectButton).toBeTruthy()
			})

			// Should NOT create any transport
			expect(createWebTransport).not.toHaveBeenCalled()
		})
	})

	describe("VS Code environment", () => {
		test("renders main app directly in VS Code environment", () => {
			;(isVSCodeEnvironment as ReturnType<typeof vi.fn>).mockReturnValue(true)

			render(React.createElement(WebApp))

			// Should not show login page or try to connect with WebSocket
			expect(createWebTransport).not.toHaveBeenCalled()
			expect(getSessionToken).not.toHaveBeenCalled()
		})
	})

	// kilocode_change: Test WebSocket message unwrapping and buffering
	describe("WebSocket message forwarding", () => {
		test("buffers messages before connected state and replays them after mount", async () => {
			;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue("test-token")

			// Create a mock transport that captures the onMessage callback
			const capturedCallback = { current: null as ((message: any) => void) | null }
			const mockTransport = {
				isConnected: true,
				onMessage: vi.fn().mockImplementation((cb: (message: any) => void) => {
					capturedCallback.current = cb
					return vi.fn() // unsubscribe function
				}),
				postMessage: vi.fn(),
				dispose: vi.fn(),
				getState: vi.fn().mockResolvedValue(undefined),
				setState: vi.fn().mockResolvedValue(undefined),
			}
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			// Listen for window message events
			const dispatchedMessages: any[] = []
			const messageHandler = (event: MessageEvent) => {
				dispatchedMessages.push(event.data)
			}
			window.addEventListener("message", messageHandler)

			render(React.createElement(WebApp))

			// Wait for transport to be set up
			await waitFor(() => {
				expect(mockTransport.onMessage).toHaveBeenCalled()
			})

			// Simulate receiving a WebSocketMessage with payload BEFORE connected state
			// (messages should be buffered, not dispatched yet)
			const callback = capturedCallback.current
			const extensionMessage = {
				type: "state",
				state: { apiConfiguration: { apiProvider: "anthropic" } },
			}
			const wsMessage = { type: "state", payload: extensionMessage }

			if (callback) {
				callback(wsMessage)
			}

			// Message should NOT be dispatched yet (buffered)
			expect(dispatchedMessages.length).toBe(0)

			// Wait for connected state (setInterval detects isConnected=true)
			// After connected, buffered messages are replayed via queueMicrotask
			await waitFor(
				() => {
					expect(dispatchedMessages.length).toBe(1)
				},
				{ timeout: 3000 },
			)

			// The dispatched message should be the unwrapped payload (ExtensionMessage),
			// not the full WebSocketMessage wrapper
			expect(dispatchedMessages[0]).toEqual(extensionMessage)
			expect(dispatchedMessages[0]).not.toEqual(wsMessage)
			expect(dispatchedMessages[0].state).toBeDefined()
			expect(dispatchedMessages[0].state.apiConfiguration).toBeDefined()

			window.removeEventListener("message", messageHandler)
		})

		test("dispatches messages immediately after connected state", async () => {
			;(getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue("test-token")

			const capturedCallback = { current: null as ((message: any) => void) | null }
			const mockTransport = {
				isConnected: true,
				onMessage: vi.fn().mockImplementation((cb: (message: any) => void) => {
					capturedCallback.current = cb
					return vi.fn()
				}),
				postMessage: vi.fn(),
				dispose: vi.fn(),
				getState: vi.fn().mockResolvedValue(undefined),
				setState: vi.fn().mockResolvedValue(undefined),
			}
			;(createWebTransport as ReturnType<typeof vi.fn>).mockReturnValue(mockTransport)

			const dispatchedMessages: any[] = []
			const messageHandler = (event: MessageEvent) => {
				dispatchedMessages.push(event.data)
			}
			window.addEventListener("message", messageHandler)

			render(React.createElement(WebApp))

			// Wait for connected state (main app renders)
			await waitFor(
				() => {
					expect(screen.getByTestId("main-app")).toBeTruthy()
				},
				{ timeout: 3000 },
			)

			// Wait for the setTimeout(200ms) in the replay effect to fire,
			// which sets isDispatchReadyRef.current = true
			await waitFor(
				() => {
					// Now send a message - should be dispatched immediately
					const callback = capturedCallback.current
					if (callback) {
						const directMessage = { type: "pong" }
						callback(directMessage)
					}
					expect(dispatchedMessages.length).toBeGreaterThanOrEqual(1)
				},
				{ timeout: 1000 },
			)

			window.removeEventListener("message", messageHandler)
		})
	})
})
