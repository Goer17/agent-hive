export interface HarnessDefinition {
  id: string;
  label: string;
  aliases: string[];
}

/** Known harnesses and the names/aliases accepted from `register.sh --harness`. */
export const HARNESSES: HarnessDefinition[] = [
  { id: "codex", label: "Codex", aliases: ["codex", "openai", "openai-codex", "codex-cli"] },
  { id: "claude-code", label: "Claude Code", aliases: ["claude-code", "claude", "anthropic", "claude-cli"] },
  { id: "pi", label: "pi", aliases: ["pi", "pi-coding-agent", "pi-agent"] },
  { id: "kimi-code", label: "Kimi Code", aliases: ["kimi-code", "kimi", "moonshot", "moonshotai", "kimi-cli"] },
  { id: "z-code", label: "Z Code", aliases: ["z-code", "zcode", "zhipu", "z-ai", "zai", "glm"] },
  { id: "hermes", label: "Hermes", aliases: ["hermes", "hermes-agent"] },
  { id: "dsh", label: "DSH", aliases: ["dsh"] },
];

export const GENERIC_HARNESS_ID = "generic";

export function normalizeHarness(value?: string | null): string | null {
  const normalized = (value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!normalized) return null;
  const match = HARNESSES.find((item) => item.id === normalized || item.aliases.includes(normalized));
  return match?.id ?? null;
}

export function harnessDefinition(value?: string | null): HarnessDefinition | null {
  const id = normalizeHarness(value);
  return id ? (HARNESSES.find((item) => item.id === id) ?? null) : null;
}

export function harnessLabel(value?: string | null): string {
  return harnessDefinition(value)?.label ?? ((value ?? "").trim() || "Unknown");
}