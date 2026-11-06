/**
 * Read HelloFresh's own recipe record from a recipe page.
 *
 * HelloFresh pages embed their app data (Next.js __NEXT_DATA__ and similar JSON). Their recipe
 * record usually has:
 * - ingredients: [{ id, name, shipped }]       (shipped: false = "not included in your delivery")
 * - yields: [{ yields: 2, ingredients: [{ id, amount, unit }] }, { yields: 4, ... }]
 * - nutrition: [{ name | type, amount, unit }]
 * - cuisines: [{ name }]
 *
 * The exact shape isn't guaranteed, so everything here is defensive: whatever can't be found is
 * left out and the import carries on with the JSON-LD data.
 */

import type { NutritionInfo } from "../../src/types";

export interface HelloFreshRecipeData {
  /** Ingredient names not shipped in the box (pantry items), lower case. */
  notShipped: Set<string>;
  /** Ingredient lists per serving size: { 2: [...], 4: [...] }. */
  yields: Map<number, { name: string; amount?: string; unit?: string }[]>;
  nutrition?: NutritionInfo;
  cuisines: string[];
}

type Json = unknown;

/** All JSON blobs embedded in <script> tags that look like app data. */
function embeddedJson(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*(?:id="__NEXT_DATA__"|type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try {
      out.push(JSON.parse(m[1]!));
    } catch {
      // not JSON
    }
  }
  return out;
}

function isRecord(v: Json): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Depth-first search for the recipe record: has ingredients[] and yields[], ideally with our id. */
function findRecipeRecord(root: Json, recipeId: string): Record<string, unknown> | null {
  let fallback: Record<string, unknown> | null = null;
  const stack: Json[] = [root];
  let visited = 0;
  while (stack.length && visited < 200_000) {
    const node = stack.pop();
    visited++;
    if (Array.isArray(node)) {
      for (const v of node) stack.push(v);
      continue;
    }
    if (!isRecord(node)) continue;
    if (Array.isArray(node.ingredients) && Array.isArray(node.yields)) {
      if (String(node.id ?? "").toLowerCase() === recipeId) return node;
      fallback ??= node;
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
  }
  return fallback;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
}

/** "570 kcal", "30.2 g", 570 -> 570 / 30.2. */
function amountOf(v: unknown): number | undefined {
  const n = num(typeof v === "string" ? v.replace(/[^\d.]/g, " ").trim().split(/\s+/)[0] : v);
  return n !== undefined ? Math.round(n * 10) / 10 : undefined;
}

const NUTRITION_NAMES: [keyof NutritionInfo, RegExp][] = [
  ["calories", /^(energy|calories|kcal)/i],
  ["saturatedFat", /saturat/i],
  ["fat", /^fat/i],
  ["sugar", /sugar/i],
  ["carbs", /carbohydrate|^carbs/i],
  ["fibre", /fib(re|er)/i],
  ["protein", /protein/i],
  ["salt", /^(salt|sodium)/i],
];

function parseNutritionList(list: unknown): NutritionInfo | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: NutritionInfo = {};
  for (const item of list) {
    if (!isRecord(item)) continue;
    const label = str(item.name) ?? str(item.type) ?? "";
    const unit = (str(item.unit) ?? "").toLowerCase();
    // Energy is often listed in both kJ and kcal; only take kcal
    if (/^energy/i.test(label) && unit && unit !== "kcal") continue;
    const key = NUTRITION_NAMES.find(([, re]) => re.test(label))?.[0];
    const value = amountOf(item.amount);
    if (key && value !== undefined && out[key] === undefined) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** schema.org NutritionInformation from JSON-LD ("calories": "570 kcal", "proteinContent": "30 g"). */
export function parseJsonLdNutrition(raw: unknown): NutritionInfo | undefined {
  if (!isRecord(raw)) return undefined;
  const map: [keyof NutritionInfo, string][] = [
    ["calories", "calories"], ["protein", "proteinContent"], ["carbs", "carbohydrateContent"],
    ["sugar", "sugarContent"], ["fat", "fatContent"], ["saturatedFat", "saturatedFatContent"],
    ["fibre", "fiberContent"], ["salt", "sodiumContent"],
  ];
  const out: NutritionInfo = {};
  for (const [key, field] of map) {
    let v = amountOf(raw[field]);
    if (v === undefined) continue;
    // Sodium in mg -> salt in g (salt ≈ sodium × 2.5)
    if (key === "salt" && /mg/i.test(String(raw[field]))) v = Math.round((v / 1000) * 2.5 * 10) / 10;
    out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function extractHelloFreshData(html: string, recipeId: string): HelloFreshRecipeData | null {
  for (const blob of embeddedJson(html)) {
    const record = findRecipeRecord(blob, recipeId);
    if (!record) continue;

    const byId = new Map<string, string>();
    const notShipped = new Set<string>();
    for (const ing of record.ingredients as unknown[]) {
      if (!isRecord(ing)) continue;
      const id = str(ing.id);
      const name = str(ing.name);
      if (!name) continue;
      if (id) byId.set(id, name);
      if (ing.shipped === false) notShipped.add(name.toLowerCase());
    }

    const yields = new Map<number, { name: string; amount?: string; unit?: string }[]>();
    for (const y of record.yields as unknown[]) {
      if (!isRecord(y)) continue;
      const size = num(y.yields ?? y.servings ?? y.yield);
      if (!size || !Array.isArray(y.ingredients)) continue;
      const list: { name: string; amount?: string; unit?: string }[] = [];
      for (const yi of y.ingredients) {
        if (!isRecord(yi)) continue;
        const name = byId.get(str(yi.id) ?? "") ?? str(yi.name);
        if (!name) continue;
        const amount = num(yi.amount);
        list.push({ name, amount: amount !== undefined && amount > 0 ? String(amount) : undefined, unit: str(yi.unit) });
      }
      if (list.length) yields.set(size, list);
    }

    const cuisines = Array.isArray(record.cuisines)
      ? (record.cuisines as unknown[]).map((c) => (isRecord(c) ? str(c.name) : str(c))).filter((c): c is string => !!c)
      : [];

    return { notShipped, yields, nutrition: parseNutritionList(record.nutrition), cuisines };
  }
  return null;
}
