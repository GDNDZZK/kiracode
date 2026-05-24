// kilocode_change - new file

import React, { useState, useCallback } from "react"

interface LoginPageProps {
	onSuccess: (sessionToken: string) => void
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
	const [accessKey, setAccessKey] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [isConnecting, setIsConnecting] = useState(false)

	const handleConnect = useCallback(async () => {
		if (!accessKey.trim()) {
			setError("Please enter an access key")
			return
		}

		setIsConnecting(true)
		setError(null)

		try {
			const response = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: accessKey }),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error("Invalid access key")
				}
				throw new Error("Failed to connect to server")
			}

			const data = await response.json()
			onSuccess(data.sessionToken)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Connection failed")
		} finally {
			setIsConnecting(false)
		}
	}, [accessKey, onSuccess])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !isConnecting) {
				handleConnect()
			}
		},
		[handleConnect, isConnecting],
	)

	return (
		<div className="flex items-center justify-center min-h-screen bg-[#1e1e1e]">
			<div className="w-full max-w-sm mx-4 p-8 rounded-lg bg-[#252526] border border-[#3c3c3c] shadow-lg">
				{/* Logo / Title */}
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold text-[#cccccc] mb-2">Kira Code</h1>
					<p className="text-sm text-[#999999]">Enter your access key to connect</p>
				</div>

				{/* Access Key Input */}
				<div className="mb-6">
					<label htmlFor="access-key" className="block text-sm font-medium text-[#cccccc] mb-2">
						Access Key
					</label>
					<input
						id="access-key"
						type="password"
						value={accessKey}
						onChange={(e) => setAccessKey(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Enter access key..."
						disabled={isConnecting}
						className="w-full px-3 py-2 rounded text-sm bg-[#3c3c3c] text-[#cccccc] border border-[#3c3c3c] focus:border-[#007fd4] focus:outline-none placeholder-[#666666] disabled:opacity-50"
					/>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 rounded text-sm bg-[#5a1d1d] text-[#f48771] border border-[#be4b4b]">
						{error}
					</div>
				)}

				{/* Connect Button */}
				<button
					onClick={handleConnect}
					disabled={isConnecting || !accessKey.trim()}
					className="w-full px-4 py-2 rounded text-sm font-medium text-white bg-[#0e639c] hover:bg-[#1177bb] focus:outline-none focus:ring-2 focus:ring-[#007fd4] focus:ring-offset-2 focus:ring-offset-[#252526] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
					{isConnecting ? "Connecting..." : "Connect"}
				</button>
			</div>
		</div>
	)
}

export default LoginPage
