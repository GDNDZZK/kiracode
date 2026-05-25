// kilocode_change - new file
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { HTMLAttributes, useState } from "react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

import { SearchableSetting } from "./SearchableSetting"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"

type WebServerStatus = {
	running: boolean
	port?: number
	error?: string
}

type WebServerSettingsProps = HTMLAttributes<HTMLDivElement> & {
	webServerPort?: number
	webServerAccessToken?: string
	webServerStatus?: WebServerStatus
	setCachedStateField: SetCachedStateField<"webServerPort" | "webServerAccessToken">
}

export const WebServerSettings = ({
	webServerPort,
	webServerAccessToken,
	webServerStatus,
	setCachedStateField,
	...props
}: WebServerSettingsProps) => {
	const { t } = useAppTranslation()
	const [showToken, setShowToken] = useState(false)

	const isRunning = webServerStatus?.running ?? false
	const displayPort = webServerStatus?.port ?? webServerPort ?? 22141

	return (
		<div {...props}>
			<SectionHeader>{t("kilocode:settings.webServer.title")}</SectionHeader>

			<p className="text-vscode-descriptionForeground text-sm mb-4">
				{t("kilocode:settings.webServer.description")}
			</p>

			<Section>
				<SearchableSetting
					settingId="webServer-port"
					section="webServer"
					label={t("kilocode:settings.webServer.portLabel")}>
					<VSCodeTextField
						value={String(webServerPort ?? 22141)}
						onInput={(e: any) => {
							const val = parseInt(e.target.value, 10)
							if (!isNaN(val) && val >= 1024 && val <= 65535) {
								setCachedStateField("webServerPort", val)
							}
						}}
					/>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("kilocode:settings.webServer.portDescription")}
					</p>
				</SearchableSetting>

				<SearchableSetting
					settingId="webServer-token"
					section="webServer"
					label={t("kilocode:settings.webServer.tokenLabel")}>
					<div className="flex items-center gap-2">
						<VSCodeTextField
							value={webServerAccessToken ?? ""}
							onInput={(e: any) => setCachedStateField("webServerAccessToken", e.target.value)}
							type={showToken ? "text" : "password"}
							placeholder={t("kilocode:settings.webServer.tokenPlaceholder")}
							className="flex-1"
						/>
						<button
							onClick={() => setShowToken(!showToken)}
							className="text-vscode-descriptionForeground hover:text-vscode-foreground p-1 rounded"
							title={
								showToken
									? t("kilocode:settings.webServer.hideToken")
									: t("kilocode:settings.webServer.showToken")
							}>
							{showToken ? (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
								</svg>
							) : (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm4.5 2.5L3.5 12.2C2.1 11.1 1 9.6.4 8c1.4-2.3 4.1-4.5 7.6-4.5 1.7 0 3.2.5 4.5 1.3v.7zM8 11.5c-.8 0-1.6-.2-2.3-.6l5.8-5.8c1.4 1 2.5 2.3 3.1 3.9-1.4 2.3-4.1 4.5-7.6 4.5-.8 0-1.6-.1-2.3-.4l1.5-1.5c.5.2 1.1.3 1.8.3z" />
								</svg>
							)}
						</button>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("kilocode:settings.webServer.tokenDescription")}
					</p>
				</SearchableSetting>

				{/* Server Status */}
				<SearchableSetting
					settingId="webServer-status"
					section="webServer"
					label={t("kilocode:settings.webServer.serverStatus")}>
					<div className="flex items-center gap-2 text-sm">
						<span
							className={`inline-block w-2.5 h-2.5 rounded-full ${isRunning ? "bg-green-500" : "bg-gray-400"}`}
						/>
						<span className="text-vscode-descriptionForeground">
							{isRunning
								? t("kilocode:settings.webServer.running", { port: displayPort })
								: t("kilocode:settings.webServer.stopped")}
						</span>
						{isRunning && (
							<span className="text-vscode-textSecondaryColor text-xs ml-2">
								http://localhost:{displayPort}
							</span>
						)}
					</div>
					{webServerStatus?.error && (
						<p className="text-vscode-errorForeground text-sm mt-1">
							{t("kilocode:settings.webServer.statusError", { error: webServerStatus.error })}
						</p>
					)}
				</SearchableSetting>

				{/* Start/Stop Button */}
				<div className="flex flex-col gap-2 mt-2">
					{isRunning ? (
						<button
							onClick={() => vscode.postMessage({ type: "stopWebServer" })}
							className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-vscode-buttonSecondaryBackground text-vscode-buttonSecondaryForeground hover:bg-vscode-buttonSecondaryHoverBackground transition-colors">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
								<rect x="1" y="1" width="10" height="10" rx="1" />
							</svg>
							{t("kilocode:settings.webServer.stopServer")}
						</button>
					) : (
						<button
							onClick={() => vscode.postMessage({ type: "startWebServer" })}
							className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-vscode-buttonBackground text-vscode-buttonForeground hover:bg-vscode-buttonHoverBackground transition-colors">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
								<path d="M2 1.5v9l8-4.5z" />
							</svg>
							{t("kilocode:settings.webServer.startServer")}
						</button>
					)}
				</div>

				{/* Security Warning */}
				<div className="flex items-start gap-2 mt-3 text-sm text-vscode-descriptionForeground">
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="currentColor"
						className="mt-0.5 shrink-0 text-vscode-notificationsWarningIcon-foreground">
						<path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1zm0 1.5l4.5 2.2V8c0 2.8-1.9 5.2-4.5 6-2.6-.8-4.5-3.2-4.5-6V4.7L8 2.5z" />
					</svg>
					<span>{t("kilocode:settings.webServer.securityWarning")}</span>
				</div>
			</Section>
		</div>
	)
}
