import { HistoryItem } from "@roo-code/types"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { TaskHistoryRequestPayload, TaskHistoryResponsePayload, TasksByIdResponsePayload } from "@roo/WebviewMessage"
import { vscode } from "@src/utils/vscode"
import { useQuery } from "@tanstack/react-query"

// UUID fallback for non-secure contexts (HTTP + non-localhost).
// crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
// When accessing via http://192.168.x.x:port from a mobile browser, the context
// is not secure and crypto.randomUUID is undefined, causing useTaskHistory to fail.
export function generateUUID(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID()
	}
	// Fallback: RFC 4122 version 4 compliant UUID
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

function fetchTask(requestId: string, taskIds: string[]): Promise<HistoryItem[]> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handle)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Timeout"))
		}, 10000)

		const handle = (event: MessageEvent) => {
			const message = event.data as ExtensionMessage
			if (message.type === "tasksByIdResponse") {
				const result = message.payload as TasksByIdResponsePayload
				if (result?.requestId !== requestId) {
					return
				}
				clearTimeout(timeout)
				cleanup()
				if (result?.tasks) {
					resolve(result.tasks)
				} else {
					reject(new Error("Task not found"))
				}
			}
		}

		window.addEventListener("message", handle)
		vscode.postMessage({ type: "tasksByIdRequest", payload: { requestId, taskIds } })
	})
}

export function useTaskWithId(taskIds: string[]) {
	return useQuery({
		queryKey: ["taskHistory", taskIds],
		queryFn: () => fetchTask(generateUUID(), taskIds),
	})
}

function fetchTaskHistory(payload: TaskHistoryRequestPayload): Promise<TaskHistoryResponsePayload> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handle)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Timeout"))
		}, 10000)

		const handle = (event: MessageEvent) => {
			const message = event.data as ExtensionMessage
			if (message.type === "taskHistoryResponse") {
				const result = message.payload as TaskHistoryResponsePayload
				if (result?.requestId !== payload.requestId) {
					return
				}
				clearTimeout(timeout)
				cleanup()
				if (result) {
					resolve(result)
				} else {
					reject(new Error("Payload is empty"))
				}
			}
		}

		window.addEventListener("message", handle)
		vscode.postMessage({ type: "taskHistoryRequest", payload })
	})
}

export function useTaskHistory(payload: Omit<TaskHistoryRequestPayload, "requestId">, taskHistoryVersion: number) {
	return useQuery({
		queryKey: ["taskHistory", String(taskHistoryVersion), JSON.stringify(payload)],
		queryFn: () => fetchTaskHistory({ ...payload, requestId: generateUUID() }),
	})
}
