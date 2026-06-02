import type { ModelInfo } from "../model.js"

// Minimax
// https://platform.minimax.io/docs/guides/pricing
// https://platform.minimax.io/docs/api-reference/text-openai-api
// https://platform.minimax.io/docs/api-reference/text-anthropic-api
export type MinimaxModelId = keyof typeof minimaxModels
export const minimaxDefaultModelId: MinimaxModelId = "MiniMax-M2"

export const minimaxModels = {
	"MiniMax-M2": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"MiniMax M2, a model born for Agents and code, featuring Top-tier Coding Capabilities, Powerful Agentic Performance, and Ultimate Cost-Effectiveness & Speed.",
	},
	"MiniMax-M2-Stable": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"MiniMax M2 Stable (High Concurrency, Commercial Use), a model born for Agents and code, featuring Top-tier Coding Capabilities, Powerful Agentic Performance, and Ultimate Cost-Effectiveness & Speed.",
	},
	"MiniMax-M2.1": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"MiniMax M2.1 builds on M2 with improved overall performance for agentic coding tasks and significantly faster response times.",
	},
	"MiniMax-M2.1-highspeed": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.6,
		outputPrice: 2.4,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"(high-speed) MiniMax M2.1 builds on M2 with improved overall performance for agentic coding tasks and significantly faster response times.",
	},
	"MiniMax-M2.5": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"MiniMax M2.5 builds on M2.1 with improved overall performance for agentic coding tasks and the same response times.",
	},
	"MiniMax-M2.5-highspeed": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.6,
		outputPrice: 2.4,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.03,
		description:
			"(high-speed) MiniMax M2.5 builds on M2.1 with improved overall performance for agentic coding tasks and significantly faster response times.",
	},
	"MiniMax-M2.7": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.06,
		description:
			"MiniMax M2.7 builds on M2.5 with improved overall performance for agentic coding tasks and the same response times.",
	},
	"MiniMax-M2.7-highspeed": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.6,
		outputPrice: 2.4,
		cacheWritesPrice: 0.375,
		cacheReadsPrice: 0.06,
		description:
			"(high-speed) MiniMax M2.7 builds on M2.5 with improved overall performance for agentic coding tasks and significantly faster response times.",
	},
	// kilocode_change start
	"MiniMax-M3": {
		maxTokens: 131_072,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.6,
		outputPrice: 2.4,
		cacheWritesPrice: 0.6,
		cacheReadsPrice: 0.12,
		description:
			"MiniMax M3 features 1M context window, native multimodal support (text, image, video), Sparse Attention architecture for efficient long-context processing, and top-tier agentic coding capabilities.",
	},
	"MiniMax-M3-highspeed": {
		maxTokens: 131_072,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		includedTools: ["search_and_replace"],
		excludedTools: ["apply_diff"],
		preserveReasoning: true,
		inputPrice: 0.9,
		outputPrice: 3.6,
		cacheWritesPrice: 0.9,
		cacheReadsPrice: 0.18,
		description:
			"(high-speed) MiniMax M3 high-speed variant with the same capabilities as M3 but significantly faster inference speed.",
	},
	// kilocode_change end
} as const satisfies Record<string, ModelInfo>

export const minimaxDefaultModelInfo: ModelInfo = minimaxModels[minimaxDefaultModelId]

export const MINIMAX_DEFAULT_MAX_TOKENS = 16_384
export const MINIMAX_DEFAULT_TEMPERATURE = 1.0
