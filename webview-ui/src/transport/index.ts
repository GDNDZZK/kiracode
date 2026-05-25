// kilocode_change - new file

import type { Transport } from "./types"
import { VSCodeTransport } from "./vscode-transport"
import { WebTransport, getSessionToken } from "./web-transport"

export type { Transport } from "./types"

/**
 * Check if we're running inside a VS Code webview.
 */
export function isVSCodeEnvironment(): boolean {
	return typeof window !== "undefined" && typeof window.acquireVsCodeApi === "function"
}

/**
 * Check if we're running in a web browser (outside VS Code).
 */
export function isWebEnvironment(): boolean {
	return typeof window !== "undefined" && typeof window.acquireVsCodeApi !== "function"
}

/**
 * Create a transport instance based on the current environment.
 * - VS Code: Uses VSCodeTransport (wraps acquireVsCodeApi)
 * - Web: Uses WebTransport (WebSocket-based)
 *
 * For Web mode, the sessionToken must be available in localStorage.
 * If no token is found, returns null (caller should show LoginPage).
 */
export function createTransport(): Transport | null {
	if (isVSCodeEnvironment()) {
		return new VSCodeTransport()
	}

	// Web environment - need session token
	const token = getSessionToken()
	if (!token) {
		return null
	}

	return new WebTransport(token)
}

/**
 * Create a Web transport with an explicit session token.
 * Used after successful authentication.
 */
export function createWebTransport(sessionToken: string): WebTransport {
	return new WebTransport(sessionToken)
}

// Re-export web transport utilities
export { getSessionToken, setSessionToken, clearSessionToken } from "./web-transport"
