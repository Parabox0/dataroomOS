import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("OpenRouter connection", () => {
  it("sends the system and user text to OpenRouter and returns the reply", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: " Runway is 26 months. [1] " }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { askClaude, aiProvider } = await import("../src/lib/claude");
    expect(aiProvider()).toBe("openrouter");
    expect(await askClaude("Answer from the files.", "What is the runway?")).toBe("Runway is 26 months. [1]");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("anthropic/claude-fable-5.2");
    expect(body.messages).toEqual([
      { role: "system", content: "Answer from the files." },
      { role: "user", content: "What is the runway?" },
    ]);
  });

  it("falls back (returns null) when OpenRouter answers with an error", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { askClaude } = await import("../src/lib/claude");
    expect(await askClaude("s", "u")).toBeNull();
    spy.mockRestore();
  });

  it("is off when no key is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { aiEnabled, askClaude } = await import("../src/lib/claude");
    expect(aiEnabled()).toBe(false);
    expect(await askClaude("s", "u")).toBeNull();
  });
});
