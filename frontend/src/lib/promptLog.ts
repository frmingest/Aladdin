/** Plain-words provider names for the System status prompt log. */
export function providerLabel(provider: string): string {
  if (provider === "google_ai_studio") return "Gemini";
  if (provider === "ollama") return "Local (Ollama)";
  if (provider === "mistral") return "Mistral";
  return provider;
}
