import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PromptLogDetail, PromptLogItem } from "../lib/types";
import { providerLabel } from "../lib/promptLog";
import { PromptDetail, PromptLogRows } from "./PromptLogCard";

const item = (over: Partial<PromptLogItem> = {}): PromptLogItem => ({
  id: "1",
  occurred_at: "2026-10-13T20:00:00Z",
  provider: "google_ai_studio",
  model_name: "gemini-test",
  call_type: "structured",
  schema_name: "EquityBlindPass",
  outcome: "success",
  error_detail: null,
  input_tokens: 1200,
  output_tokens: 300,
  latency_ms: 4200,
  prompt_chars: 18500,
  preview: "Evidence packet for ASML…",
  ...over,
});

describe("Prompt log", () => {
  it("names the provider in plain words", () => {
    expect(providerLabel("google_ai_studio")).toBe("Gemini");
    expect(providerLabel("ollama")).toBe("Local (Ollama)");
  });

  it("lists each call with provider, schema, outcome, size and a preview", () => {
    const html = renderToStaticMarkup(
      <PromptLogRows items={[item(), item({ id: "2", outcome: "error", provider: "ollama", schema_name: null })]} />,
    );
    expect(html).toContain("Gemini");
    expect(html).toContain("EquityBlindPass");
    expect(html).toContain("18.5k chars");
    expect(html).toContain("Evidence packet for ASML…");
    expect(html).toContain("Failed");
    expect(html).toContain("Local (Ollama)");
  });

  it("shows the full prompts and reply, and the error when a call failed", () => {
    const detail: PromptLogDetail = {
      ...item({ outcome: "error", error_detail: "LLMUnavailableError: timed out" }),
      system_prompt: "You are the analyst.",
      user_prompt: "EVIDENCE E1: revenue grew",
      response_text: null,
    };
    const html = renderToStaticMarkup(<PromptDetail detail={detail} />);
    expect(html).toContain("You are the analyst.");
    expect(html).toContain("EVIDENCE E1: revenue grew");
    expect(html).toContain("LLMUnavailableError: timed out");
    expect(html).not.toContain("Model reply");
  });
});
