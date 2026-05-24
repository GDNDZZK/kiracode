// kilocode_change - new file

import React, { useState, useEffect, useCallback, useRef } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import LoginPage from "./LoginPage"
import {
	type Transport,
	createWebTransport,
	setSessionToken,
	clearSessionToken,
	getSessionToken,
} from "../../transport"
import { isVSCodeEnvironment } from "../../transport"
import { setWebTransport } from "../../utils/vscode"

// Lazy-load the main App component to avoid importing VS Code-specific code
// until we know we're in a connected state
const AppWithProviders = React.lazy(() => import("../../App"))

const queryClient = new QueryClient()

type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

const WebApp: React.FC = () => {
	const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
	const connectionStateRef = useRef<ConnectionState>(connectionState)
	const [transport, setTransport] = useState<Transport | null>(null)
	const transportRef = useRef<Transport | null>(null)

	// Keep ref in sync with state
	useEffect(() => {
		connectionStateRef.current = connectionState
	}, [connectionState])

	const connectWithToken = useCallback((token: string) => {
		setConnectionState("connecting")

		try {
			const webTransport = createWebTransport(token)

			// Wait a bit for the WebSocket to connect
			// The WebTransport constructor initiates the connection
			const checkConnected = setInterval(() => {
				if (webTransport.isConnected) {
					clearInterval(checkConnected)
					setSessionToken(token)
					setConnectionState("connected")
				}
			}, 100)

			// Timeout after 10 seconds
			setTimeout(() => {
				clearInterval(checkConnected)
				if (connectionStateRef.current === "connecting") {
					webTransport.dispose()
					setConnectionState("error")
					clearSessionToken()
				}
			}, 10000)

			// Clean up previous transport
			if (transportRef.current) {
				transportRef.current.dispose()
			}
			transportRef.current = webTransport
			setTransport(webTransport)
		} catch (error) {
			console.error("[WebApp] Failed to create transport:", error)
			setConnectionState("error")
			clearSessionToken()
		}
	}, [])

	// Try to restore session from URL params or localStorage on mount
	useEffect(() => {
		if (isVSCodeEnvironment()) {
			// In VS Code, no need for WebApp logic
			return
		}

		// First check URL params (from login page redirect)
		const urlParams = new URLSearchParams(window.location.search)
		const tokenFromUrl = urlParams.get("sessionToken")

		if (tokenFromUrl) {
			// Store token from URL into localStorage for persistence
			setSessionToken(tokenFromUrl)
			// Clean up URL to avoid exposing token in address bar
			window.history.replaceState({}, document.title, window.location.pathname)
			connectWithToken(tokenFromUrl)
			return
		}

		// Fall back to localStorage (page refresh scenario)
		const existingToken = getSessionToken()
		if (existingToken) {
			connectWithToken(existingToken)
		}
	}, [connectWithToken])

	// Set up transport message forwarding to window for ExtensionStateContext
	useEffect(() => {
		if (!transport) return

		const unsubscribe = transport.onMessage((message: any) => {
			// kilocode_change: Unwrap WebSocketMessage to extract ExtensionMessage payload.
			// WebSocket messages from WebServerBridge are wrapped as {type, payload}
			// where payload is the actual ExtensionMessage. ExtensionStateContext
			// expects event.data to be an ExtensionMessage directly, so we need
			// to unwrap the payload here to avoid double-wrapping issues that
			// cause apiConfiguration to be undefined.
			const extensionMessage = message.payload ?? message
			window.dispatchEvent(
				new MessageEvent("message", {
					data: extensionMessage,
				}),
			)
		})

		return unsubscribe
	}, [transport])

	// Set the web transport override so vscode.postMessage routes through WebSocket
	useEffect(() => {
		if (!transport || isVSCodeEnvironment()) return

		setWebTransport(transport)

		return () => {
			setWebTransport(null)
		}
	}, [transport])

	const handleLoginSuccess = useCallback(
		(sessionToken: string) => {
			connectWithToken(sessionToken)
		},
		[connectWithToken],
	)

	const _handleDisconnect = useCallback(() => {
		if (transportRef.current) {
			transportRef.current.dispose()
			transportRef.current = null
		}
		setTransport(null)
		setConnectionState("disconnected")
		clearSessionToken()
	}, [])

	// If in VS Code environment, render the main app directly
	if (isVSCodeEnvironment()) {
		return (
			<React.Suspense
				fallback={<div className="flex items-center justify-center h-screen text-[#999999]">Loading...</div>}>
				<AppWithProviders />
			</React.Suspense>
		)
	}

	// Not connected - show login page
	if (connectionState === "disconnected" || connectionState === "error") {
		return <LoginPage onSuccess={handleLoginSuccess} />
	}

	// Connecting
	if (connectionState === "connecting") {
		return (
			<div className="flex items-center justify-center min-h-screen bg-[#1e1e1e]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e639c] mx-auto mb-4"></div>
					<p className="text-[#999999]">Connecting...</p>
				</div>
			</div>
		)
	}

	// Connected - render the main app
	return (
		<QueryClientProvider client={queryClient}>
			<React.Suspense
				fallback={<div className="flex items-center justify-center h-screen text-[#999999]">Loading...</div>}>
				<AppWithProviders />
			</React.Suspense>
		</QueryClientProvider>
	)
}

export default WebApp
