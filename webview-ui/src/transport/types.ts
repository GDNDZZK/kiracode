// kilocode_change - new file

/**
 * Transport interface for communication between webview and extension.
 * In VS Code mode, this wraps the VS Code webview API.
 * In Web mode, this uses WebSocket for communication.
 */
export interface Transport {
	/**
	 * Send a message to the extension.
	 */
	postMessage(message: any): void

	/**
	 * Register a callback to receive messages from the extension.
	 * Returns an unsubscribe function.
	 */
	onMessage(callback: (message: any) => void): () => void

	/**
	 * Get the persistent state.
	 */
	getState(): Promise<any>

	/**
	 * Set the persistent state.
	 */
	setState(state: any): Promise<void>

	/**
	 * Clean up resources (event listeners, WebSocket connections, etc.).
	 */
	dispose(): void
}
