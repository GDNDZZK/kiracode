// kilocode_change - new file

import { resolve } from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

import { sourcemapPlugin } from "./src/vite-plugins/sourcemapPlugin"

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", { target: "18" }]],
			},
		}),
		tailwindcss(),
		sourcemapPlugin(),
	],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@src": resolve(__dirname, "./src"),
			"@roo": resolve(__dirname, "../src/shared"),
		},
	},
	build: {
		outDir: "./dist-web",
		emptyOutDir: true,
		reportCompressedSize: false,
		sourcemap: true,
		minify: "esbuild",
		rollupOptions: {
			external: ["vscode"],
			input: {
				web: resolve(__dirname, "web.html"),
			},
			output: {
				entryFileNames: `assets/[name].js`,
				chunkFileNames: (chunkInfo) => {
					if (chunkInfo.name === "mermaid-bundle") {
						return `assets/mermaid-bundle.js`
					}
					return `assets/chunk-[hash].js`
				},
				assetFileNames: (assetInfo) => {
					const name = assetInfo.name || ""
					if (name.endsWith(".woff2") || name.endsWith(".woff") || name.endsWith(".ttf")) {
						return "assets/fonts/[name][extname]"
					}
					if (name.endsWith(".map")) {
						return "assets/[name]"
					}
					return "assets/[name][extname]"
				},
				manualChunks: (id, { getModuleInfo }) => {
					if (
						id.includes("node_modules/mermaid") ||
						id.includes("node_modules/dagre") ||
						id.includes("node_modules/cytoscape")
					) {
						return "mermaid-bundle"
					}
					const moduleInfo = getModuleInfo(id)
					if (moduleInfo?.importers.some((importer) => importer.includes("node_modules/mermaid"))) {
						return "mermaid-bundle"
					}
					if (moduleInfo?.dynamicImporters.some((importer) => importer.includes("node_modules/mermaid"))) {
						return "mermaid-bundle"
					}
				},
			},
		},
	},
	define: {
		"process.platform": JSON.stringify(process.platform),
		"process.env.VSCODE_TEXTMATE_DEBUG": JSON.stringify(process.env.VSCODE_TEXTMATE_DEBUG),
		"process.env.PKG_NAME": JSON.stringify("kilo-code"),
		"process.env.PKG_VERSION": JSON.stringify("0.0.0"),
		"process.env.PKG_OUTPUT_CHANNEL": JSON.stringify("Kilo-Code"),
	},
	optimizeDeps: {
		include: ["mermaid", "dagre"],
		exclude: ["@vscode/codicons", "vscode-oniguruma", "shiki", "vscode"],
	},
	assetsInclude: ["**/*.wasm", "**/*.wav"],
})
