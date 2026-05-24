// kilocode_change - new file

import type { Transport } from "./types"

const STATE_KEY = "kilocode_web_state"
const TOKEN_KEY = "kilocode_session_token"
const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY = 1000 // 1 second
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 10000 // 10 seconds

/**
 * Web transport implementation using WebSocket.
 * Used when running in a browser outside of VS Code.
 */
export class WebTransport implements Transport {
	private ws: WebSocket | null = null
	private messageCallbacks: Set<(message: any) => void> = new Set()
	private reconnectAttempts = 0
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null
	private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
	private sessionToken: string
	private disposed = false

	constructor(sessionToken: string) {
		this.sessionToken = sessionToken
		this.connect()
	}

	private connect(): void {
		if (this.disposed) return

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
		const wsUrl = `${protocol}//${window.location.host}/ws?sessionToken=${encodeURIComponent(this.sessionToken)}`

		try {
			this.ws = new WebSocket(wsUrl)
			this.setupWebSocketHandlers()
		} catch (error) {
			console.error("[WebTransport] Failed to create WebSocket:", error)
			this.scheduleReconnect()
		}
	}

	private setupWebSocketHandlers(): void {
		if (!this.ws) return

		this.ws.onopen = () => {
			console.log("[WebTransport] WebSocket connected")
			this.reconnectAttempts = 0
			this.startHeartbeat()
		}

		this.ws.onmessage = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data)

				// Handle heartbeat response
				if (data.type === "pong") {
					this.resetHeartbeatTimeout()
					return
				}

				// Forward to all registered callbacks
				this.messageCallbacks.forEach((callback) => {
					try {
						callback(data)
					} catch (error) {
						console.error("[WebTransport] Error in message callback:", error)
					}
				})
			} catch (error) {
				console.error("[WebTransport] Failed to parse WebSocket message:", error)
			}
		}

		this.ws.onclose = (event: CloseEvent) => {
			console.log(`[WebTransport] WebSocket closed: code=${event.code}, reason=${event.reason}`)
			this.stopHeartbeat()

			if (!this.disposed) {
				this.scheduleReconnect()
			}
		}

		this.ws.onerror = (event: Event) => {
			console.error("[WebTransport] WebSocket error:", event)
		}
	}

	private scheduleReconnect(): void {
		if (this.disposed || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
				console.error("[WebTransport] Max reconnect attempts reached")
			}
			return
		}

		// Exponential backoff with jitter
		const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000
		this.reconnectAttempts++

		console.log(
			`[WebTransport] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
		)

		this.reconnectTimer = setTimeout(() => {
			this.connect()
		}, delay)
	}

	private startHeartbeat(): void {
		this.stopHeartbeat()
		this.heartbeatTimer = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: "ping" }))

				// Set timeout for heartbeat response
				this.heartbeatTimeoutTimer = setTimeout(() => {
					console.warn("[WebTransport] Heartbeat timeout, closing connection")
					this.ws?.close()
				}, HEARTBEAT_TIMEOUT)
			}
		}, HEARTBEAT_INTERVAL)
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
		this.resetHeartbeatTimeout()
	}

	private resetHeartbeatTimeout(): void {
		if (this.heartbeatTimeoutTimer) {
			clearTimeout(this.heartbeatTimeoutTimer)
			this.heartbeatTimeoutTimer = null
		}
	}

	postMessage(message: any): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message))
		} else {
			console.warn("[WebTransport] WebSocket not ready, message not sent:", message)
		}
	}

	onMessage(callback: (message: any) => void): () => void {
		this.messageCallbacks.add(callback)
		return () => {
			this.messageCallbacks.delete(callback)
		}
	}

	async getState(): Promise<any> {
		try {
			const state = localStorage.getItem(STATE_KEY)
			return state ? JSON.parse(state) : undefined
		} catch (error) {
			console.error("[WebTransport] Failed to get state:", error)
			return undefined
		}
	}

	async setState(state: any): Promise<void> {
		try {
			localStorage.setItem(STATE_KEY, JSON.stringify(state))
		} catch (error) {
			console.error("[WebTransport] Failed to set state:", error)
		}
	}

	/**
	 * Check if the WebSocket is currently connected.
	 */
	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN
	}

	dispose(): void {
		this.disposed = true
		this.stopHeartbeat()

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if (this.ws) {
			this.ws.onclose = null // Prevent reconnect on intentional close
			this.ws.onerror = null
			this.ws.onmessage = null
			this.ws.onopen = null
			this.ws.close()
			this.ws = null
		}

		this.messageCallbacks.clear()
	}
}

/**
 * Get the stored session token from localStorage.
 */
export function getSessionToken(): string | null {
	return localStorage.getItem(TOKEN_KEY)
}

/**
 * Store the session token in localStorage.
 */
export function setSessionToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Remove the session token from localStorage.
 */
export function clearSessionToken(): void {
	localStorage.removeItem(TOKEN_KEY)
}
