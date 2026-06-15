import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	type ModelInfo,
	ZAI_DEFAULT_TEMPERATURE,
	zaiApiLineConfigs,
} from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens, shouldUseReasoningEffort } from "../../shared/api"
import { convertToZAiFormat } from "../transform/zai-format"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

// Custom interface for Z.ai params to support thinking mode
type ZAiChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled"; budget_tokens?: number }
}

export class ZAiHandler extends BaseOpenAiCompatibleProvider<string> {
	constructor(options: ApiHandlerOptions) {
		const isChina = zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].isChina
		const models = (isChina ? mainlandZAiModels : internationalZAiModels) as unknown as Record<string, ModelInfo>
		const defaultModelId = (isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId) as string

		super({
			...options,
			providerName: "Z.ai",
			baseURL: zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].baseUrl,
			apiKey: options.zaiApiKey ?? "not-provided",
			defaultProviderModelId: defaultModelId,
			providerModels: models,
			defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
		})
	}

	// kilocode_change start
	/**
	 * Override createStream to handle Z.ai models with thinking mode.
	 * Thinking-capable models have reasoning enabled by default in the API,
	 * so we explicitly send { type: "disabled" } when users turn reasoning off.
	 */
	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { info } = this.getModel()

		// Thinking models advertise explicit reasoning effort support.
		const isThinkingModel = Array.isArray(info.supportsReasoningEffort)

		if (isThinkingModel) {
			// For thinking-enabled models, thinking is ON by default in the API.
			// We need to explicitly disable it when reasoning is off.
			const useReasoning = shouldUseReasoningEffort({ model: info, settings: this.options })

			// Determine the reasoning effort level for GLM-5.2+ models
			const reasoningEffort = this.options.reasoningEffort ?? info.reasoningEffort

			// Create the stream with our custom thinking parameter
			return this.createStreamWithThinking(systemPrompt, messages, metadata, useReasoning, reasoningEffort)
		}

		// For non-thinking models, use the default behavior
		return super.createStream(systemPrompt, messages, metadata, requestOptions)
	}
	// kilocode_change end

	// kilocode_change start
	/**
	 * Creates a stream with explicit thinking control for Z.ai thinking models.
	 * GLM-5.2+ models support "high" and "max" reasoning effort levels,
	 * while earlier models (GLM-4.7, GLM-5, GLM-5.1) use "medium".
	 */
	private createStreamWithThinking(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		useReasoning?: boolean,
		reasoningEffort?: string,
	) {
		const { id: model, info } = this.getModel()

		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		// Use Z.ai format to preserve reasoning_content and merge post-tool text into tool messages
		const convertedMessages = convertToZAiFormat(messages, { mergeToolResultText: true })

		// Build thinking parameter based on reasoning effort
		let thinkingParam: ZAiChatCompletionParams["thinking"]
		if (!useReasoning) {
			thinkingParam = { type: "disabled" }
		} else if (reasoningEffort === "xhigh") {
			// xhigh effort (GLM-5.2 Max): enable thinking with budget_tokens for deep reasoning
			thinkingParam = { type: "enabled", budget_tokens: Math.floor((max_tokens ?? 131_072) * 0.8) }
		} else {
			// high or medium effort: enable thinking without budget limit
			thinkingParam = { type: "enabled" }
		}

		const params: ZAiChatCompletionParams = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertedMessages],
			stream: true,
			stream_options: { include_usage: true },
			thinking: thinkingParam,
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			...(metadata?.toolProtocol === "native" && {
				parallel_tool_calls: metadata.parallelToolCalls ?? false,
			}),
		}

		return this.client.chat.completions.create(params)
	}
	// kilocode_change end
}
