import { loadAIConfig, resolveConfig, callTextAI, type ProviderEnv } from "./ai-providers";
import { blendKey } from "../../src/lib/mealkit";

/**
 * Supermarket names for meal-kit-only products ("Hard Italian Style Cheese" -> "Grana Padano").
 * Asks the AI once per product name ever; answers (including "no swap needed") are cached in KV.
 * Returns only names that need a swap, keyed by blendKey(name).
 */

interface SwapEnv extends ProviderEnv {
  WHISK_KV: KVNamespace;
}

const CACHE_PREFIX = "product_swap:v1:";
const ANTHROPIC_SWAP_MODEL = "claude-sonnet-5-5";
const MAX_NAMES = 30;

interface Cached {
  swap: string | null;
}

function cleanSwap(v: unknown, original: string): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[*"]/g, "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 40 || s.toLowerCase() === original.toLowerCase()) return null;
  return s;
}

export async function resolveProductSwaps(
  env: SwapEnv,
  names: string[],
  context: { title?: string } = {}
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = [...new Map(names.map((n) => [blendKey(n), n])).entries()].slice(0, MAX_NAMES);
  if (!unique.length) return result;

  const misses: [string, string][] = [];
  await Promise.all(
    unique.map(async ([key, name]) => {
      const cached = (await env.WHISK_KV.get(CACHE_PREFIX + key, "json").catch(() => null)) as Cached | null;
      if (cached && "swap" in cached) {
        if (cached.swap) result[key] = cached.swap;
      } else {
        misses.push([key, name]);
      }
    })
  );
  if (!misses.length) return result;

  const config = await loadAIConfig(env.WHISK_KV);
  const fnConfig = resolveConfig(config, "chat", env);
  if (!fnConfig) return result;
  const swapConfig = fnConfig.provider === "anthropic" ? { ...fnConfig, model: ANTHROPIC_SWAP_MODEL } : fnConfig;

  const prompt = [
    "These ingredient names come from a UK meal kit (HelloFresh or similar).",
    context.title ? `Recipe: "${context.title}".` : "",
    "Some are the kit's own names for things a UK supermarket sells under a different name",
    '(e.g. "Hard Italian Style Cheese" is sold as "Grana Padano", "Mature Cheddar Cheese" is fine as it is).',
    "For each, give the name to look for in a UK supermarket, or null if the name is already what you'd buy.",
    "Keep swaps short (1-4 words), a real product, no brands. Don't change spices, fresh produce or meat cuts that are already clear.",
    "",
    "Ingredients:",
    ...misses.map(([, name], i) => `${i + 1}. ${name}`),
    "",
    'Reply with JSON only: {"swaps":[{"name":"<as given>","swap":"<supermarket name>" | null}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const content = await callTextAI(swapConfig, env, [{ role: "user", content: prompt }], { maxTokens: 1500 });
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return result;
    const parsed = JSON.parse(content.slice(start, end + 1)) as { swaps?: { name?: unknown; swap?: unknown }[] };
    const answered = new Set<string>();
    for (const [i, raw] of (parsed.swaps ?? []).entries()) {
      const echoed = typeof raw.name === "string" ? blendKey(raw.name) : "";
      const hit = misses.find(([k]) => k === echoed) ?? misses[i];
      if (!hit || answered.has(hit[0])) continue;
      answered.add(hit[0]);
      const swap = cleanSwap(raw.swap, hit[1]);
      if (swap) result[hit[0]] = swap;
      await env.WHISK_KV.put(CACHE_PREFIX + hit[0], JSON.stringify({ swap } satisfies Cached)).catch(() => {});
    }
  } catch {
    // AI unavailable: keep the kit's names
  }
  return result;
}
