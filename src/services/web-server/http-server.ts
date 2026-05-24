// kilocode_change - new file

import * as http from "http"
import * as fs from "fs"
import * as path from "path"
import type { WebServerConfig } from "./types"
import { validateToken, createSessionToken, validateSessionToken } from "./auth"
// kilocode_change start
import { RateLimiter } from "./rate-limiter"
// kilocode_change end

/** 会话令牌验证辅助函数 */
function checkSessionToken(req: http.IncomingMessage, serverSecret: string): Promise<boolean> {
	return new Promise((resolve) => {
		const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
		const sessionToken =
			url.searchParams.get("sessionToken") || req.headers.authorization?.replace("Bearer ", "") || ""

		if (!sessionToken) {
			resolve(false)
			return
		}

		resolve(validateSessionToken(sessionToken, serverSecret))
	})
}

/**
 * 创建 HTTP 服务器
 * @param config Web Server 配置
 * @param staticPath 静态文件目录路径（webview-ui 构建产物）
 * @param serverSecret 服务器端密钥（用于会话令牌签名）
 * @param log 日志函数
 * @returns http.Server 实例
 */
// kilocode_change start: Add assetsPath parameter for serving extension icons
export function createHttpServer(
	config: WebServerConfig,
	staticPath: string,
	assetsPath: string,
	serverSecret: string,
	log: (message: string) => void,
): http.Server {
	// kilocode_change end
	// kilocode_change start
	const authRateLimiter = new RateLimiter(10, 60 * 1000) // 每 IP 每分钟最多 10 次认证尝试
	// kilocode_change end

	const server = http.createServer(async (req, res) => {
		// 添加安全响应头
		res.setHeader("X-Content-Type-Options", "nosniff")
		res.setHeader("X-Frame-Options", "DENY")
		res.setHeader(
			"Content-Security-Policy",
			"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;",
		)

		const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
		const pathname = url.pathname

		try {
			// GET / — 登录页面
			if (pathname === "/" && req.method === "GET") {
				const loginHtml = getLoginPage()
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				res.end(loginHtml)
				return
			}

			// GET /api/health — 健康检查
			if (pathname === "/api/health" && req.method === "GET") {
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ status: "ok" }))
				return
			}

			// POST /api/auth — 认证接口
			if (pathname === "/api/auth" && req.method === "POST") {
				// kilocode_change start
				const clientIp = req.socket.remoteAddress || "unknown"
				const rateLimitResult = authRateLimiter.check(clientIp)
				if (!rateLimitResult.allowed) {
					const retryAfterSeconds = Math.ceil(rateLimitResult.retryAfterMs / 1000)
					res.writeHead(429, {
						"Content-Type": "application/json",
						"Retry-After": String(retryAfterSeconds),
					})
					res.end(JSON.stringify({ error: "Too Many Requests", retryAfter: retryAfterSeconds }))
					return
				}
				// kilocode_change end
				await handleAuthRequest(req, res, config, serverSecret, log)
				return
			}

			// GET /api/status — 服务器状态（需认证）
			if (pathname === "/api/status" && req.method === "GET") {
				const isAuthed = await checkSessionToken(req, serverSecret)
				if (!isAuthed) {
					res.writeHead(401, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ error: "Unauthorized" }))
					return
				}

				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						status: "running",
						port: config.port,
						timestamp: Date.now(),
					}),
				)
				return
			}

			// GET * — 静态文件服务
			if (req.method === "GET") {
				// kilocode_change: Try staticPath first, then fall back to assetsPath for icons etc.
				await serveStaticFile(pathname, staticPath, assetsPath, res, log)
				return
			}

			// 未匹配的路由
			res.writeHead(404, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Not Found" }))
		} catch (error) {
			log(
				`[WebServer] Error handling request ${pathname}: ${error instanceof Error ? error.message : String(error)}`,
			)
			res.writeHead(500, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Internal Server Error" }))
		}
	})

	// 清理 RateLimiter 资源
	server.on("close", () => {
		authRateLimiter.destroy()
	})

	return server
}

/**
 * 处理认证请求
 */
function handleAuthRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	config: WebServerConfig,
	serverSecret: string,
	log: (message: string) => void,
): Promise<void> {
	return new Promise((resolve) => {
		let body = ""

		req.on("data", (chunk: Buffer) => {
			body += chunk.toString()
		})

		req.on("end", () => {
			try {
				const parsed = JSON.parse(body) as { token?: string }
				const token = parsed.token

				if (!token) {
					res.writeHead(400, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ success: false, error: "Token is required" }))
					resolve()
					return
				}

				const isValid = validateToken(token, config.accessToken)

				if (isValid) {
					const sessionToken = createSessionToken(serverSecret)
					log("[WebServer] Authentication successful")
					res.writeHead(200, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ success: true, sessionToken }))
				} else {
					log("[WebServer] Authentication failed: invalid token")
					res.writeHead(401, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ success: false, error: "Invalid token" }))
				}
			} catch (error) {
				log(`[WebServer] Error parsing auth request: ${error instanceof Error ? error.message : String(error)}`)
				res.writeHead(400, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ success: false, error: "Invalid request body" }))
			}

			resolve()
		})

		req.on("error", (error: Error) => {
			log(`[WebServer] Auth request error: ${error.message}`)
			res.writeHead(500, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ success: false, error: "Request error" }))
			resolve()
		})
	})
}

// kilocode_change start: Add assetsPath parameter for serving extension icons and other assets
/**
 * 提供静态文件服务
 * 先在 staticPath (dist-web) 中查找，找不到时回退到 assetsPath (extension assets/icons)
 */
async function serveStaticFile(
	pathname: string,
	staticPath: string,
	assetsPath: string,
	res: http.ServerResponse,
	log: (message: string) => void,
): Promise<void> {
	// 安全检查：防止路径遍历攻击
	const sanitizedPath = pathname.replace(/\.\./g, "").replace(/\/\//g, "/")

	// 先尝试在 staticPath (dist-web) 中查找
	let filePath = path.join(staticPath, sanitizedPath)

	// 如果路径指向目录，尝试提供 index.html
	try {
		const stat = await fs.promises.stat(filePath)
		if (stat.isDirectory()) {
			filePath = path.join(filePath, "index.html")
		}
		// 文件存在于 staticPath，直接提供
		await sendFile(filePath, res, log)
		return
	} catch {
		// 文件不在 staticPath 中，继续尝试其他路径
	}

	// kilocode_change: Try assetsPath for extension icons and other assets
	// For icon files like /kilo-dark.svg, look in assetsPath/icons/
	let assetsFilePath = path.join(assetsPath, sanitizedPath)
	try {
		const stat = await fs.promises.stat(assetsFilePath)
		if (stat.isDirectory()) {
			// Don't serve directories from assets
		} else {
			await sendFile(assetsFilePath, res, log)
			return
		}
	} catch {
		// File not found at assetsPath root, try icons/ subdirectory
		// This handles requests like /kilo-dark.svg which are actually at assetsPath/icons/kilo-dark.svg
		assetsFilePath = path.join(assetsPath, "icons", sanitizedPath)
		try {
			const stat = await fs.promises.stat(assetsFilePath)
			if (!stat.isDirectory()) {
				await sendFile(assetsFilePath, res, log)
				return
			}
		} catch {
			// File not in assetsPath/icons/ either, continue to SPA fallback
		}
	}

	// SPA 回退：返回 web.html（Web 模式 SPA 回退）
	const spaFilePath = path.join(staticPath, "web.html")
	try {
		await sendFile(spaFilePath, res, log)
	} catch (error) {
		log(`[WebServer] Static file not found: ${pathname} (staticPath: ${staticPath}, assetsPath: ${assetsPath})`)
		res.writeHead(404, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ error: "Not Found" }))
	}
}

/**
 * 发送文件内容到客户端
 */
async function sendFile(filePath: string, res: http.ServerResponse, log: (message: string) => void): Promise<void> {
	const content = await fs.promises.readFile(filePath)

	// 根据文件扩展名设置 Content-Type
	const ext = path.extname(filePath).toLowerCase()
	const contentTypes: Record<string, string> = {
		".html": "text/html; charset=utf-8",
		".js": "application/javascript; charset=utf-8",
		".mjs": "application/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".svg": "image/svg+xml",
		".ico": "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf": "font/ttf",
		".eot": "application/vnd.ms-fontobject",
		".wasm": "application/wasm",
	}

	const contentType = contentTypes[ext] || "application/octet-stream"
	res.writeHead(200, { "Content-Type": contentType })
	res.end(content)
}
// kilocode_change end

/**
 * 返回登录页面 HTML
 */
function getLoginPage(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kira Code - Web Access</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .login-container {
            background: #16213e;
            border-radius: 12px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .login-container h1 {
            text-align: center;
            margin-bottom: 8px;
            font-size: 24px;
            color: #ffffff;
        }
        .login-container p {
            text-align: center;
            margin-bottom: 24px;
            font-size: 14px;
            color: #a0a0a0;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            color: #c0c0c0;
        }
        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #2a2a4a;
            border-radius: 8px;
            background: #0f0f23;
            color: #ffffff;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s;
        }
        .form-group input:focus {
            border-color: #4a9eff;
        }
        .submit-btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #4a9eff;
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        .submit-btn:hover {
            background: #3a8eef;
        }
        .submit-btn:disabled {
            background: #2a2a4a;
            cursor: not-allowed;
        }
        .error-message {
            color: #ff6b6b;
            font-size: 14px;
            text-align: center;
            margin-top: 12px;
            display: none;
        }
        .success-message {
            color: #51cf66;
            font-size: 14px;
            text-align: center;
            margin-top: 12px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Kira Code</h1>
        <p>Enter your access token to continue</p>
        <form id="loginForm">
            <div class="form-group">
                <label for="token">Access Token</label>
                <input type="password" id="token" name="token" placeholder="Enter your access token" required autocomplete="off" />
            </div>
            <button type="submit" class="submit-btn" id="submitBtn">Connect</button>
            <div class="error-message" id="errorMessage"></div>
            <div class="success-message" id="successMessage">Authentication successful! Redirecting...</div>
        </form>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const token = document.getElementById('token').value;
            const submitBtn = document.getElementById('submitBtn');
            const errorMessage = document.getElementById('errorMessage');
            const successMessage = document.getElementById('successMessage');

            submitBtn.disabled = true;
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';

            try {
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                const data = await response.json();

                if (data.success && data.sessionToken) {
                    successMessage.style.display = 'block';
                    localStorage.setItem('kilocode_session_token', data.sessionToken);
                    setTimeout(function() {
                        window.location.href = '/app?sessionToken=' + encodeURIComponent(data.sessionToken);
                    }, 500);
                } else {
                    errorMessage.textContent = data.error || 'Authentication failed';
                    errorMessage.style.display = 'block';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                errorMessage.textContent = 'Connection error';
                errorMessage.style.display = 'block';
                submitBtn.disabled = false;
            }
        });
    </script>
</body>
</html>`
}
