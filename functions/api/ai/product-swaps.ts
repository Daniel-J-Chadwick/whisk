import type { ProviderEnv } from "../../lib/ai-providers";
import { resolveProductSwaps } from "../../lib/product-swaps";

interface Env extends ProviderEnv {
  WHISK_KV: KVNamespace;
}

// POST /api/ai/product-swaps - { names: string[], title?: string } -> { swaps: { [blendKey]: string } }
// Supermarket names for meal-kit-only products. Used by the "Re-import HelloFresh recipes" button
// for scanned recipes; the URL import calls resolveProductSwaps directly.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => null)) as { names?: unknown; title?: unknown } | null;
  const names = Array.isArray(body?.names)
    ? body!.names.filter((n): n is string => typeof n === "string" && n.trim().length > 0 && n.length <= 80).slice(0, 30)
    : [];
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : undefined;
  const swaps = names.length ? await resolveProductSwaps(env, names, { title }) : {};
  return new Response(JSON.stringify({ swaps }), {
    headers: { "Content-Type": "application/json" },
  });
};
