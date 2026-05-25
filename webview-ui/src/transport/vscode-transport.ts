// kilocode_change - new file

import type { Transport } from "./types"

/**
 * VS Code transport implementation.
 * Wraps the existing VS Code webview API (acquireVsCodeApi).
 * This is used when running inside a VS Code webview panel.
 */
export class VSCodeTransport implements Transport {
	private readonly vsCodeApi: any

	constructor() {
		if (typeof acquireVsCodeApi === "function") {
			this.vsCodeApi = acquireVsCodeApi()
		}
	}

	postMessage(message: any): void {
		if (this.vsCodeApi) {
			this.vsCodeApi.postMessage(message)
		} else {
			console.log("[VSCodeTransport] No VS Code API available, message not sent:", message)
		}
	}

	onMessage(callback: (message: any) => void): () => void {
		const handler = (event: MessageEvent) => {
			callback(event.data)
		}
		window.addEventListener("message", handler)
		return () => {
			window.removeEventListener("message", handler)
		}
	}

	async getState(): Promise<any> {
		if (this.vsCodeApi) {
			return this.vsCodeApi.getState()
		}
		const state = localStorage.getItem("vscodeState")
		return state ? JSON.parse(state) : undefined
	}

	async setState(state: any): Promise<void> {
		if (this.vsCodeApi) {
			this.vsCodeApi.setState(state)
		} else {
			localStorage.setItem("vscodeState", JSON.stringify(state))
		}
	}

	dispose(): void {
		// No cleanup needed for VS Code transport
	}
}
