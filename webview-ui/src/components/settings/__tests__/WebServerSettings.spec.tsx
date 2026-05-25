// kilocode_change - new file
import { render, screen, fireEvent } from "@testing-library/react"

import { WebServerSettings } from "../WebServerSettings"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, any>) => {
			const translations: Record<string, string> = {
				"kilocode:settings.webServer.title": "Web Access",
				"kilocode:settings.webServer.description": "Remote access to Kira Code via browser",
				"kilocode:settings.webServer.portLabel": "Port Number",
				"kilocode:settings.webServer.portDescription": "Port range: 1024-65535",
				"kilocode:settings.webServer.tokenLabel": "Access Token",
				"kilocode:settings.webServer.tokenPlaceholder": "Enter access token",
				"kilocode:settings.webServer.tokenDescription": "Token for authentication",
				"kilocode:settings.webServer.showToken": "Show token",
				"kilocode:settings.webServer.hideToken": "Hide token",
				"kilocode:settings.webServer.serverStatus": "Server Status",
				"kilocode:settings.webServer.running": `Running on port ${options?.port ?? ""}`,
				"kilocode:settings.webServer.stopped": "Stopped",
				"kilocode:settings.webServer.startServer": "Start Server",
				"kilocode:settings.webServer.stopServer": "Stop Server",
				"kilocode:settings.webServer.securityWarning": "Ensure you use this in a trusted network environment",
				"kilocode:settings.webServer.statusError": options?.error ?? "Error",
			}
			return translations[key] || key
		},
	}),
}))

// Mock vscode API
const { postMessageMock } = vi.hoisted(() => ({
	postMessageMock: vi.fn(),
}))
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: postMessageMock,
	},
}))

// Mock VSCodeTextField
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ value, onInput, type, placeholder, className, ...rest }: any) => (
		<div data-testid="vscode-text-field" className={className}>
			<input
				type={type || "text"}
				value={value}
				onChange={(e) => onInput && onInput({ target: { value: e.target.value } })}
				placeholder={placeholder}
				{...rest}
			/>
		</div>
	),
}))

// Mock SearchableSetting
vi.mock("../SearchableSetting", () => ({
	SearchableSetting: ({ children, label, settingId }: any) => (
		<div data-testid={`searchable-setting-${settingId}`}>
			<label>{label}</label>
			{children}
		</div>
	),
}))

// Mock Section
vi.mock("../Section", () => ({
	Section: ({ children }: any) => <div data-testid="section">{children}</div>,
}))

// Mock SectionHeader
vi.mock("../SectionHeader", () => ({
	SectionHeader: ({ children }: any) => <h3 data-testid="section-header">{children}</h3>,
}))

describe("WebServerSettings", () => {
	const mockSetCachedStateField = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Rendering", () => {
		it("renders the component with title and description", () => {
			render(
				<WebServerSettings
					webServerPort={22141}
					webServerAccessToken="test-token"
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			expect(screen.getByTestId("section-header")).toHaveTextContent("Web Access")
			expect(screen.getByText("Remote access to Kira Code via browser")).toBeInTheDocument()
		})

		it("renders port input with default value", () => {
			render(<WebServerSettings webServerPort={22141} setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			expect(portSetting).toBeInTheDocument()
			const input = portSetting.querySelector("input")
			expect(input).toHaveValue("22141")
		})

		it("renders port input with fallback to 22141 when no port provided", () => {
			render(<WebServerSettings setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			const input = portSetting.querySelector("input")
			expect(input).toHaveValue("22141")
		})

		it("renders token input as password field by default", () => {
			render(
				<WebServerSettings webServerAccessToken="secret-token" setCachedStateField={mockSetCachedStateField} />,
			)

			const tokenSetting = screen.getByTestId("searchable-setting-webServer-token")
			const input = tokenSetting.querySelector("input")
			expect(input).toHaveAttribute("type", "password")
			expect(input).toHaveValue("secret-token")
		})

		it("renders server status as stopped when no status provided", () => {
			render(<WebServerSettings setCachedStateField={mockSetCachedStateField} />)

			const statusSetting = screen.getByTestId("searchable-setting-webServer-status")
			expect(statusSetting).toHaveTextContent("Stopped")
		})

		it("renders server status as running when server is running", () => {
			render(
				<WebServerSettings
					webServerPort={22141}
					webServerStatus={{ running: true, port: 22141 }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			const statusSetting = screen.getByTestId("searchable-setting-webServer-status")
			expect(statusSetting).toHaveTextContent("Running on port 22141")
			expect(statusSetting).toHaveTextContent("http://localhost:22141")
		})

		it("renders security warning", () => {
			render(<WebServerSettings setCachedStateField={mockSetCachedStateField} />)

			expect(screen.getByText("Ensure you use this in a trusted network environment")).toBeInTheDocument()
		})
	})

	describe("Start/Stop Buttons", () => {
		it("renders start button when server is stopped", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: false }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			expect(screen.getByText("Start Server")).toBeInTheDocument()
			expect(screen.queryByText("Stop Server")).not.toBeInTheDocument()
		})

		it("renders stop button when server is running", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: true, port: 22141 }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			expect(screen.getByText("Stop Server")).toBeInTheDocument()
			expect(screen.queryByText("Start Server")).not.toBeInTheDocument()
		})

		it("sends startWebServer message when start button is clicked", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: false }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			fireEvent.click(screen.getByText("Start Server"))

			expect(postMessageMock).toHaveBeenCalledWith({ type: "startWebServer" })
		})

		it("sends stopWebServer message when stop button is clicked", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: true, port: 22141 }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			fireEvent.click(screen.getByText("Stop Server"))

			expect(postMessageMock).toHaveBeenCalledWith({ type: "stopWebServer" })
		})
	})

	describe("Port Input", () => {
		it("calls setCachedStateField when valid port is entered", () => {
			render(<WebServerSettings webServerPort={22141} setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			const input = portSetting.querySelector("input")!
			fireEvent.change(input, { target: { value: "3000" } })

			expect(mockSetCachedStateField).toHaveBeenCalledWith("webServerPort", 3000)
		})

		it("does not call setCachedStateField for port below 1024", () => {
			render(<WebServerSettings webServerPort={22141} setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			const input = portSetting.querySelector("input")!
			fireEvent.change(input, { target: { value: "80" } })

			expect(mockSetCachedStateField).not.toHaveBeenCalled()
		})

		it("does not call setCachedStateField for port above 65535", () => {
			render(<WebServerSettings webServerPort={22141} setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			const input = portSetting.querySelector("input")!
			fireEvent.change(input, { target: { value: "99999" } })

			expect(mockSetCachedStateField).not.toHaveBeenCalled()
		})

		it("does not call setCachedStateField for NaN input", () => {
			render(<WebServerSettings webServerPort={22141} setCachedStateField={mockSetCachedStateField} />)

			const portSetting = screen.getByTestId("searchable-setting-webServer-port")
			const input = portSetting.querySelector("input")!
			fireEvent.change(input, { target: { value: "abc" } })

			expect(mockSetCachedStateField).not.toHaveBeenCalled()
		})
	})

	describe("Token Input", () => {
		it("calls setCachedStateField when token is changed", () => {
			render(<WebServerSettings webServerAccessToken="" setCachedStateField={mockSetCachedStateField} />)

			const tokenSetting = screen.getByTestId("searchable-setting-webServer-token")
			const input = tokenSetting.querySelector("input")!
			fireEvent.change(input, { target: { value: "new-token" } })

			expect(mockSetCachedStateField).toHaveBeenCalledWith("webServerAccessToken", "new-token")
		})

		it("toggles token visibility when eye button is clicked", () => {
			render(<WebServerSettings webServerAccessToken="secret" setCachedStateField={mockSetCachedStateField} />)

			const tokenSetting = screen.getByTestId("searchable-setting-webServer-token")
			const input = tokenSetting.querySelector("input")!
			const toggleButton = tokenSetting.querySelector("button")!

			// Initially password
			expect(input).toHaveAttribute("type", "password")

			// Click toggle
			fireEvent.click(toggleButton)

			// Should now be text
			expect(input).toHaveAttribute("type", "text")
		})
	})

	describe("Error Display", () => {
		it("displays error message when status has error", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: false, error: "Port already in use" }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			expect(screen.getByText("Port already in use")).toBeInTheDocument()
		})

		it("does not display error when no error in status", () => {
			render(
				<WebServerSettings
					webServerStatus={{ running: false }}
					setCachedStateField={mockSetCachedStateField}
				/>,
			)

			// No error text should be present
			const statusSetting = screen.getByTestId("searchable-setting-webServer-status")
			const errorElements = statusSetting.querySelectorAll(".text-vscode-errorForeground")
			expect(errorElements).toHaveLength(0)
		})
	})
})
