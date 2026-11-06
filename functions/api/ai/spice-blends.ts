import type { ProviderEnv } from "../../lib/ai-providers";
import { resolveSpiceBlends } from "../../lib/spice-blends";

interface Env extends ProviderEnv {
  WHISK_KV: KVNamespace;
}

// POST /api/ai/spice-blends - { names: string[], title?: string } -> { blends: { [blendKey]: BlendRecipe } }
// Works out what's in meal-kit spice sachets. Used by the "Re-import HelloFresh recipes" button
// for scanned recipes; the URL and photo imports call resolveSpiceBlends directly.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => null)) as { names?: unknown; title?: unknown } | null;
  const names = Array.isArray(body?.names)
    ? body!.names.filter((n): n is string => typeof n === "string" && n.trim().length > 0 && n.length <= 80).slice(0, 6)
    : [];
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : undefined;
  const blends = names.length ? await resolveSpiceBlends(env, names, { title }) : {};
  return new Response(JSON.stringify({ blends }), {
    headers: { "Content-Type": "application/json" },
  });
};
