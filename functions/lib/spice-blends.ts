import { loadAIConfig, resolveConfig, callTextAI, type ProviderEnv } from "./ai-providers";
import { blendKey, type BlendRecipe } from "../../src/lib/mealkit";

/**
 * Work out what's in meal-kit spice sachets ("Central American Style Spice") using the AI,
 * as everyday spices in teaspoons per sachet. Answers are cached in KV for good, so each
 * blend name costs one AI call ever. Returns only the blends it could resolve; callers
 * fall back to the built-in table for the rest.
 */

interface SpiceEnv extends ProviderEnv {
  WHISK_KV: KVNamespace;
}

const CACHE_PREFIX = "spice_blend:v1:";
// Blend breakdowns need cooking knowledge more than speed; prefer Sonnet when using Anthropic.
const ANTHROPIC_BLEND_MODEL = "claude-sonnet-5-5";

function validate(raw: unknown): BlendRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { label?: unknown; parts?: unknown };
  if (!Array.isArray(r.parts)) return null;
  const parts = r.parts
    .map((p) => {
      const part = p as { name?: unknown; tsp?: unknown };
      const name = typeof part.name === "string" ? part.name.toLowerCase().replace(/\s+/g, " ").trim() : "";
      const tsp = typeof part.tsp === "number" ? part.tsp : parseFloat(String(part.tsp ?? ""));
      if (!name || name.length > 40 || !Number.isFinite(tsp) || tsp <= 0 || tsp > 3) return null;
      return { name, tsp };
    })
    .filter((p): p is { name: string; tsp: number } => p !== null)
    .slice(0, 8);
  const total = parts.reduce((sum, p) => sum + p.tsp, 0);
  if (parts.length < 2 || total > 8) return null;
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 50) : "Spice mix";
  return { label, parts };
}

export async function resolveSpiceBlends(
  env: SpiceEnv,
  names: string[],
  context: { title?: string } = {}
): Promise<Record<string, BlendRecipe>> {
  const result: Record<string, BlendRecipe> = {};
  const unique = [...new Map(names.map((n) => [blendKey(n), n])).entries()].slice(0, 6);
  if (unique.length === 0) return result;

  // Cached answers first
  const misses: [string, string][] = [];
  await Promise.all(
    unique.map(async ([key, name]) => {
      const cached = await env.WHISK_KV.get(CACHE_PREFIX + key, "json").catch(() => null);
      const valid = validate(cached);
      if (valid) result[key] = valid;
      else misses.push([key, name]);
    })
  );
  if (misses.length === 0) return result;

  const config = await loadAIConfig(env.WHISK_KV);
  const fnConfig = resolveConfig(config, "chat", env);
  if (!fnConfig) return result;
  const blendConfig = fnConfig.provider === "anthropic" ? { ...fnConfig, model: ANTHROPIC_BLEND_MODEL } : fnConfig;

  const prompt = [
    "These are pre-mixed spice sachets from a UK meal kit (HelloFresh or similar). Each sachet is about 5 g, roughly 1 tablespoon.",
    context.title ? `They are used in the recipe "${context.title}".` : "",
    "For each sachet, estimate what's in it using everyday spices and dried herbs sold in UK supermarkets, so someone can make it at home.",
    "",
    "Sachets:",
    ...misses.map(([, name], i) => `${i + 1}. ${name}`),
    "",
    "Rules:",
    "- 3 to 7 parts per blend, amounts in teaspoons for ONE sachet (multiples of 0.25), totalling about 3 teaspoons.",
    '- Use plain supermarket names in lower case: "ground cumin", "smoked paprika", "dried oregano", "garlic powder", "chilli flakes".',
    "- No fresh ingredients, no salt, no sugar unless the blend is clearly sweet or a rub.",
    '- label: a short generic name such as "Mexican-style spice mix".',
    "",
    'Reply with JSON only: {"blends":[{"name":"<sachet name as given>","label":"...","parts":[{"name":"...","tsp":1}]}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const content = await callTextAI(blendConfig, env, [{ role: "user", content: prompt }], { maxTokens: 1500 });
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return result;
    const parsed = JSON.parse(content.slice(start, end + 1)) as { blends?: { name?: unknown }[] };
    for (const [i, raw] of (parsed.blends ?? []).entries()) {
      // Match by the name the AI echoed, falling back to position
      const echoed = typeof raw.name === "string" ? blendKey(raw.name) : "";
      const key = misses.find(([k]) => k === echoed)?.[0] ?? misses[i]?.[0];
      const valid = validate(raw);
      if (!key || !valid || result[key]) continue;
      result[key] = valid;
      await env.WHISK_KV.put(CACHE_PREFIX + key, JSON.stringify(valid)).catch(() => {});
    }
  } catch {
    // AI unavailable or bad reply: callers use the built-in table
  }
  return result;
}
