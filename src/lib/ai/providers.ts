/**
 * Unified LLM provider abstraction — routes generation calls to OpenAI or Anthropic
 * based on environment configuration.
 *
 * Provider selection: LLM_PROVIDER env var ("openai" | "anthropic", default: "openai")
 * Falls back to OpenAI if Anthropic key is missing.
 */

export type LLMProvider = "openai" | "anthropic";

export type LLMOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  timeout?: number;
};

export type LLMResult = {
  content: string;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
};

/**
 * Determine which provider to use based on env config and available keys.
 */
export function getProvider(): LLMProvider {
  const preference = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  if (preference === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }
  return "openai";
}

/**
 * Get the model name for the active provider.
 */
export function getModel(provider: LLMProvider): string {
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  }
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/**
 * Call the configured LLM provider and return JSON content.
 */
export async function callLLM(options: LLMOptions): Promise<LLMResult> {
  const provider = getProvider();
  if (provider === "anthropic") {
    return callAnthropic(options);
  }
  return callOpenAI(options);
}

// ── OpenAI ──

async function callOpenAI(options: LLMOptions): Promise<LLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 120_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
        max_completion_tokens: options.maxTokens ?? 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI로부터 응답이 없습니다");

    return {
      content: content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim(),
      usage: {
        model: data.model ?? model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI 응답 시간이 초과되었습니다. 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Anthropic ──

async function callAnthropic(options: LLMOptions): Promise<LLMResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 8192,
    system: options.systemPrompt,
    messages: [
      { role: "user", content: options.userPrompt },
      // Prefill assistant with "{" to steer JSON output
      { role: "assistant", content: "{" },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock?.text ?? "";

  // Prepend the "{" we used as prefill
  const content = "{" + rawText;

  return {
    content: content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim(),
    usage: {
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
