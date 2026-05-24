// kilocode_change - new file

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import nock from "nock"

// Allow localhost connections for these integration tests
nock.enableNetConnect("localhost")

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

// Mock vscode module
vi.mock("vscode", () => ({
	extensions: {
		getExtension: vi.fn().mockReturnValue({
			extensionPath: "/mock/extension/path",
		}),
	},
	window: {
		createOutputChannel: vi.fn().mockReturnValue({
			appendLine: vi.fn(),
		}),
		createTextEditorDecorationType: vi.fn().mockReturnValue({}),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
	},
	Uri: {
		parse: vi.fn().mockReturnValue({ toString: () => "" }),
		joinPath: vi.fn().mockReturnValue({ toString: () => "" }),
		file: vi.fn().mockReturnValue({ toString: () => "" }),
	},
	Disposable: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock webviewMessageHandler
vi.mock("../../core/webview/webviewMessageHandler", () => ({
	webviewMessageHandler: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks are set up
import { WebServerService } from "../index"

function createMockProvider() {
	return {
		postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		log: vi.fn(),
		getStateToPostToWebview: vi.fn().mockResolvedValue({ mode: "code", tasks: [] }),
		marketplaceManager: undefined,
	}
}

function createMockOutputChannel() {
	return {
		appendLine: vi.fn(),
	}
}

describe("WebServerService", () => {
	let service: WebServerService
	let outputChannel: ReturnType<typeof createMockOutputChannel>
	let provider: ReturnType<typeof createMockProvider>

	beforeEach(() => {
		vi.clearAllMocks()
		outputChannel = createMockOutputChannel()
		provider = createMockProvider()
		service = new WebServerService(outputChannel as any)
	})

	afterEach(async () => {
		service.dispose()
	})

	describe("start", () => {
		it("should start the server successfully", async () => {
			const config = {
				enabled: true,
				port: 0, // Use random available port
				accessToken: "test-token",
			}

			const status = await service.start(config, provider as any)

			expect(status.running).toBe(true)
			expect(status.port).toBe(config.port)
			expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("Server started"))
		})

		it("should return disabled status when not enabled", async () => {
			const config = {
				enabled: false,
				port: 22141,
				accessToken: "test-token",
			}

			const status = await service.start(config, provider as any)

			expect(status.running).toBe(false)
		})

		it("should return error when access token is empty", async () => {
			const config = {
				enabled: true,
				port: 22141,
				accessToken: "",
			}

			const status = await service.start(config, provider as any)

			expect(status.running).toBe(false)
			expect(status.error).toBeTruthy()
		})

		it("should update internal status when access token is empty so getStatus() returns the error", async () => {
			const config = {
				enabled: true,
				port: 22141,
				accessToken: "",
			}

			await service.start(config, provider as any)

			// Verify getStatus() also returns the error (not just the return value of start())
			const status = service.getStatus()
			expect(status.running).toBe(false)
			expect(status.error).toContain("Access token is not configured")
		})

		it("should stop existing server before starting new one", async () => {
			const config1 = {
				enabled: true,
				port: 0,
				accessToken: "test-token-1",
			}

			const status1 = await service.start(config1, provider as any)
			expect(status1.running).toBe(true)

			const config2 = {
				enabled: true,
				port: 0,
				accessToken: "test-token-2",
			}

			const status2 = await service.start(config2, provider as any)
			expect(status2.running).toBe(true)
		})
	})

	describe("stop", () => {
		it("should stop a running server", async () => {
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)
			expect(service.getStatus().running).toBe(true)

			await service.stop()
			expect(service.getStatus().running).toBe(false)
		})

		it("should handle stopping when not running", async () => {
			await service.stop()
			expect(service.getStatus().running).toBe(false)
		})
	})

	describe("restart", () => {
		it("should restart the server", async () => {
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)
			const status = await service.restart(config, provider as any)

			expect(status.running).toBe(true)
		})
	})

	describe("getStatus", () => {
		it("should return not running initially", () => {
			const status = service.getStatus()
			expect(status.running).toBe(false)
		})

		it("should return running after start", async () => {
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)
			const status = service.getStatus()

			expect(status.running).toBe(true)
		})
	})

	describe("updateConfig", () => {
		it("should restart when config changes", async () => {
			const config1 = {
				enabled: true,
				port: 0,
				accessToken: "token-1",
			}

			await service.start(config1, provider as any)

			const config2 = {
				enabled: true,
				port: 0,
				accessToken: "token-2",
			}

			await service.updateConfig(config2, provider as any)

			expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("Configuration changed"))
		})

		it("should not restart when config unchanged", async () => {
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)

			await service.updateConfig(config, provider as any)

			expect(outputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Configuration updated (no restart needed)"),
			)
		})
	})

	describe("dispose", () => {
		it("should clean up all resources", async () => {
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)
			service.dispose()

			expect(service.getStatus().running).toBe(false)
		})

		it("should handle dispose when not running", () => {
			service.dispose()
			expect(service.getStatus().running).toBe(false)
		})
	})

	// kilocode_change start: test getStaticPath uses correct extension ID
	describe("getStaticPath", () => {
		it("should use correct extension ID 'kiracode.kira-code' to resolve static path", async () => {
			const { extensions } = await import("vscode")
			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)

			// Verify getExtension was called with the correct ID
			expect(extensions.getExtension).toHaveBeenCalledWith("kiracode.kira-code")

			// Verify the static path was logged (includes extensionPath from mock)
			expect(outputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("/mock/extension/path/webview-ui/dist-web"),
			)
		})

		it("should fallback to __dirname-based path when extension is not found", async () => {
			const { extensions } = await import("vscode")
			// Mock getExtension to return undefined (extension not found)
			vi.mocked(extensions.getExtension).mockReturnValueOnce(undefined as any)

			const config = {
				enabled: true,
				port: 0,
				accessToken: "test-token",
			}

			await service.start(config, provider as any)

			// Verify getExtension was called with the correct ID
			expect(extensions.getExtension).toHaveBeenCalledWith("kiracode.kira-code")

			// Verify the static path was logged (fallback path using __dirname)
			expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("webview-ui/dist-web"))
		})
	})
	// kilocode_change end
})
