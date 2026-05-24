---
"kilo-code": patch
---

Fix WebSocket authentication failure (code=4001) by using req.url instead of ws.url to extract sessionToken from query parameters
