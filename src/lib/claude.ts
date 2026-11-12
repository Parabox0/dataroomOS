// Optional AI connection. Answers, summaries and checks are written by Claude when a key is set:
// OPENROUTER_API_KEY (Claude through OpenRouter) or ANTHROPIC_API_KEY (Claude directly).
// With neither, the app uses its built-in search based versions, and the screens say so.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { APP_NAME } from "@/lib/brand";

export const MODEL = process.env.DATAROOM_MODEL || "claude-opus-5-5";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-fable-5.2";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Which connection is used. OpenRouter wins when both keys are set. */
export function aiProvider(): "openrouter" | "anthropic" | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

let client: Anthropic | undefined;

/** One short request. Returns the text, or null if the model declined or the call failed (callers then fall back). */
export async function askClaude(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  const provider = aiProvider();
  if (!provider) return null;
  try {
    return provider === "openrouter" ? await viaOpenRouter(system, user, maxTokens) : await viaAnthropic(system, user, maxTokens);
  } catch (e) {
    console.error(`[dataroom] ${provider} request failed, using built-in answer instead:`, (e as Error).message);
    return null;
  }
}

async function viaAnthropic(system: string, user: string, maxTokens: number): Promise<string | null> {
  client ??= new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    // Routes a declined request to a fallback model chosen by the API.
    fallbacks: "default",
  } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal") return null;
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text || null;
}

type OpenRouterReply = { choices?: { message?: { content?: string | null }; finish_reason?: string | null }[]; error?: { message?: string } };

async function viaOpenRouter(system: string, user: string, maxTokens: number): Promise<string | null> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": APP_NAME,
      ...(process.env.DATAROOM_PUBLIC_URL ? { "HTTP-Referer": process.env.DATAROOM_PUBLIC_URL } : {}),
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = (await res.json().catch(() => ({}))) as OpenRouterReply;
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${data.error?.message ?? "no details"}`);
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter" || choice?.finish_reason === "refusal") return null;
  const text = (choice?.message?.content ?? "").trim();
  return text || null;
}
