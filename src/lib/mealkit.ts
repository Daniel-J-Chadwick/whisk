/**
 * Clean-up for meal-kit recipes (HelloFresh and similar).
 *
 * 1. Bare amounts: meal-kit ingredient lists often drop the unit, so "450 potatoes"
 *    means 450 g. Unitless amounts of 10 or more become g (or ml for liquids).
 * 2. "unit" is a plain count ("1 unit red onion").
 * 3. Pre-mixed spice sachets you can't buy are split into an estimated mix of
 *    everyday spices, grouped under the blend's name so the steps still make sense.
 * 4. Single-spice sachets ("1 sachet smoked paprika") become a teaspoon of that spice.
 * 5. Stock paste sachets become stock cubes (one 10 g sachet is about one cube).
 *
 * Shared by the URL import, the photo import and the "re-import HelloFresh" button.
 * Pure: no network, no React.
 */

export interface MealKitIngredient {
  name: string;
  amount?: string;
  unit?: string;
  group?: string;
  category?: string;
}

export interface BlendPart {
  name: string;
  /** Teaspoons per sachet. */
  tsp: number;
}

interface Blend {
  match: RegExp;
  label: string;
  parts: BlendPart[];
}

// Estimated recipes for one sachet (about 1 tablespoon / 5 g), from typical versions of each blend.
const BLENDS: Blend[] = [
  {
    match: /\b(central american|mexican|tex[- ]?mex|fajita|taco|burrito)\b.*\b(spice|seasoning|mix|blend)\b/,
    label: "Mexican-style spice mix",
    parts: [
      { name: "ground cumin", tsp: 1 },
      { name: "smoked paprika", tsp: 1 },
      { name: "dried oregano", tsp: 0.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "ground coriander", tsp: 0.25 },
      { name: "chilli powder", tsp: 0.25 },
    ],
  },
  {
    match: /\bcajun\b|\bcreole\b/,
    label: "Cajun spice mix",
    parts: [
      { name: "smoked paprika", tsp: 1 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "onion powder", tsp: 0.5 },
      { name: "dried thyme", tsp: 0.5 },
      { name: "dried oregano", tsp: 0.25 },
      { name: "cayenne pepper", tsp: 0.25 },
    ],
  },
  {
    match: /\b(moroccan|north african|ras el hanout)\b/,
    label: "Moroccan-style spice mix",
    parts: [
      { name: "ground cumin", tsp: 1 },
      { name: "ground coriander", tsp: 0.75 },
      { name: "ground cinnamon", tsp: 0.5 },
      { name: "paprika", tsp: 0.5 },
      { name: "ground ginger", tsp: 0.25 },
      { name: "ground turmeric", tsp: 0.25 },
    ],
  },
  {
    match: /\b(middle eastern|levantine|lebanese|shawarma|baharat)\b/,
    label: "Middle Eastern-style spice mix",
    parts: [
      { name: "ground cumin", tsp: 1 },
      { name: "ground coriander", tsp: 0.75 },
      { name: "paprika", tsp: 0.5 },
      { name: "ground cinnamon", tsp: 0.25 },
      { name: "ground allspice", tsp: 0.25 },
      { name: "ground black pepper", tsp: 0.25 },
    ],
  },
  {
    match: /\b(persian|iranian)\b/,
    label: "Persian-style spice mix",
    parts: [
      { name: "ground cumin", tsp: 1 },
      { name: "ground turmeric", tsp: 0.5 },
      { name: "ground cinnamon", tsp: 0.5 },
      { name: "ground coriander", tsp: 0.5 },
      { name: "dried mint", tsp: 0.5 },
    ],
  },
  {
    match: /\b(indian|curry|tikka|tandoori|korma|balti|bombay)\b.*\b(spice|seasoning|mix|blend|powder)\b/,
    label: "Indian-style spice mix",
    parts: [
      { name: "garam masala", tsp: 1 },
      { name: "ground cumin", tsp: 0.5 },
      { name: "ground coriander", tsp: 0.5 },
      { name: "ground turmeric", tsp: 0.5 },
      { name: "chilli powder", tsp: 0.25 },
      { name: "ground ginger", tsp: 0.25 },
    ],
  },
  {
    match: /\b(thai|south ?east asian|malaysian|indonesian)\b.*\b(spice|seasoning|mix|blend)\b/,
    label: "Thai-style spice mix",
    parts: [
      { name: "ground coriander", tsp: 1 },
      { name: "ground cumin", tsp: 0.5 },
      { name: "ground ginger", tsp: 0.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "ground turmeric", tsp: 0.25 },
      { name: "chilli flakes", tsp: 0.25 },
    ],
  },
  {
    match: /\b(caribbean|jerk|jamaican)\b/,
    label: "Caribbean-style jerk seasoning",
    parts: [
      { name: "ground allspice", tsp: 1 },
      { name: "dried thyme", tsp: 0.5 },
      { name: "paprika", tsp: 0.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "ground cinnamon", tsp: 0.25 },
      { name: "cayenne pepper", tsp: 0.25 },
    ],
  },
  {
    match: /\b(greek|mediterranean)\b.*\b(spice|seasoning|herb|mix|blend)\b/,
    label: "Greek-style seasoning",
    parts: [
      { name: "dried oregano", tsp: 1.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "dried mint", tsp: 0.5 },
      { name: "dried thyme", tsp: 0.25 },
      { name: "ground black pepper", tsp: 0.25 },
    ],
  },
  {
    match: /\b(italian|tuscan)\b.*\b(spice|seasoning|herb|mix|blend)\b/,
    label: "Italian-style herbs",
    parts: [
      { name: "dried oregano", tsp: 1 },
      { name: "dried basil", tsp: 1 },
      { name: "dried thyme", tsp: 0.5 },
      { name: "dried rosemary", tsp: 0.25 },
      { name: "garlic powder", tsp: 0.25 },
    ],
  },
  {
    match: /\b(bbq|barbecue|smoky|smokey|southern)\b.*\b(spice|seasoning|rub|mix|blend)\b/,
    label: "BBQ spice rub",
    parts: [
      { name: "smoked paprika", tsp: 1 },
      { name: "brown sugar", tsp: 0.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "onion powder", tsp: 0.5 },
      { name: "chilli powder", tsp: 0.25 },
      { name: "ground cumin", tsp: 0.25 },
    ],
  },
  {
    match: /\b(korean|japanese|chinese|cantonese|sichuan|szechuan)\b.*\b(spice|seasoning|mix|blend)\b/,
    label: "East Asian-style spice mix",
    parts: [
      { name: "chinese five spice", tsp: 0.75 },
      { name: "ground ginger", tsp: 0.5 },
      { name: "garlic powder", tsp: 0.5 },
      { name: "chilli flakes", tsp: 0.25 },
      { name: "ground white pepper", tsp: 0.25 },
    ],
  },
];

/** Spices sold on their own: a sachet is roughly a teaspoon. */
const SINGLE_SPICES =
  /^(?:ground |dried |smoked |hot |sweet |mild |whole )*(?:paprika|cumin|coriander|turmeric|cinnamon|nutmeg|ginger|allspice|cardamom|fennel seeds?|cumin seeds?|mustard seeds?|chilli flakes|chili flakes|red pepper flakes|chilli powder|chili powder|cayenne(?: pepper)?|garam masala|curry powder|chinese five spice|five spice|mixed herbs|mixed spice|oregano|thyme|basil|rosemary|sage|dill|mint|tarragon|parsley|bay leaf|bay leaves|sumac|za'?atar|dukkah|nigella seeds|sesame seeds|garlic powder|onion powder|black pepper|white pepper|star anise)$/;

const LIQUID = /\b(oil|vinegar|glaze|milk|soy sauce|tamari|fish sauce|mirin|wine|juice|water|stock|broth|cream|passata|coconut milk|syrup)\b/;
const COUNTED = /\b(eggs?|tortillas?|wraps?|buns?|rolls?|naans?|pittas?|flatbreads?|crumpets?|muffins?|bagels?)\b/;
const SACHET = /^(sachets?|packets?|pots?|small pots?|pouch(?:es)?)$/i;

function parseAmount(amount: string | undefined): number | null {
  if (!amount) return null;
  const t = amount.trim().replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").trim();
  let total = 0;
  let any = false;
  for (const part of t.split(/\s+/)) {
    const frac = /^(\d+)\/(\d+)$/.exec(part);
    if (frac) {
      total += Number(frac[1]) / Number(frac[2]);
      any = true;
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part);
      any = true;
    } else {
      return null;
    }
  }
  return any ? total : null;
}

/** 1.25 -> "1 1/4", 0.5 -> "1/2", 3 -> "3". Rounds to the nearest quarter. */
export function formatTsp(value: number): string {
  const q = Math.max(0.25, Math.round(value * 4) / 4);
  const whole = Math.floor(q);
  const rest = q - whole;
  const frac = rest === 0.25 ? "1/4" : rest === 0.5 ? "1/2" : rest === 0.75 ? "3/4" : "";
  if (!whole) return frac;
  return frac ? `${whole} ${frac}` : String(whole);
}

/** How many sachets an ingredient line represents (a 5 g sachet when given in grams). */
function sachetCount(amount: string | undefined, unit: string | undefined): number {
  const qty = parseAmount(amount) ?? 1;
  const u = (unit ?? "").toLowerCase().trim();
  if (u === "g" || u === "gram" || u === "grams") return Math.max(0.5, qty / 5);
  if (u === "tsp" || u === "teaspoon" || u === "teaspoons") return qty / 3;
  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") return qty;
  return qty;
}

function cleanName(name: string): string {
  return name.replace(/\*+/g, "").replace(/^\(s\)\s*/i, "").replace(/\s+/g, " ").trim();
}

/** Short spellings for metric units ("grams" -> "g", "milliliter(s)" -> "ml"). */
const SHORT_UNITS: Record<string, string> = {
  gram: "g", grams: "g", kilogram: "kg", kilograms: "kg",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
};

function findBlend(lowerName: string): Blend | undefined {
  // A blend mentions spice/seasoning/mix, or is one of the named regional blends.
  return BLENDS.find((b) => b.match.test(lowerName));
}

/** True when this looks like a meal-kit ingredient list worth cleaning. */
export function looksLikeMealKit(ingredients: MealKitIngredient[]): boolean {
  return ingredients.some((i) => SACHET.test((i.unit ?? "").trim()) || /\bsachets?\b/i.test(i.name) || /^units?$/i.test(i.unit ?? ""));
}

/** A blend's estimated make-up per sachet, as worked out by the AI (or the built-in table). */
export interface BlendRecipe {
  /** Short name for the mix, e.g. "Mexican-style spice mix". */
  label: string;
  parts: BlendPart[];
}

export interface MealKitOptions {
  /** Treat unitless amounts of 10+ as grams (or ml for liquids). On for meal-kit sources. */
  bareAmountsAreMetric?: boolean;
  /**
   * Blend recipes keyed by blendKey(name), usually from the AI. Used before the built-in
   * table, which is only a fallback for when the AI isn't available.
   */
  blends?: Record<string, BlendRecipe>;
}

/** Lookup key for a blend name: lower case, no "sachet", single spaces, no footnote marks. */
export function blendKey(name: string): string {
  return cleanName(name).toLowerCase().replace(/\bsachets?(?: of)?\b/g, "").replace(/\s+/g, " ").trim();
}

const BLEND_WORDS = /\b(spice|spices|seasoning|rub|mix|blend|herbs|masala|curry powder)\b/;
const STOCK = /^(chicken|beef|vegetable|veg|lamb|pork|fish|mushroom)\s+stock\s+(paste|pot|concentrate|gel)$/;

/** Names of the pre-mixed spice sachets in a list (not single spices or stock), for the AI to work out. */
export function findBlendSachets(ingredients: MealKitIngredient[]): string[] {
  const names = new Set<string>();
  for (const ing of ingredients) {
    const unitLower = (ing.unit ?? "").toLowerCase().replace(/\(s\)$/, "").trim();
    const key = blendKey(ing.name);
    const isSachet = SACHET.test(unitLower) || /\bsachets?\b/i.test(ing.name) || unitLower === "g";
    if (!isSachet || !BLEND_WORDS.test(key) || SINGLE_SPICES.test(key) || STOCK.test(key)) continue;
    if (unitLower === "g" && (parseAmount(ing.amount) ?? 0) > 20) continue; // a 100 g bag isn't a sachet
    names.add(cleanName(ing.name));
  }
  return [...names];
}

/**
 * Undo an earlier blend split ("... (instead of Central American Style Spice)") back into one
 * sachet line, so it can be worked out again. The sachet count is estimated from the teaspoons.
 */
export function collapseEstimatedBlends(ingredients: MealKitIngredient[]): MealKitIngredient[] {
  const out: MealKitIngredient[] = [];
  const seen = new Map<string, MealKitIngredient>();
  for (const ing of ingredients) {
    const m = /\(instead of (.+)\)$/.exec(ing.group ?? "");
    if (!m) {
      out.push(ing);
      continue;
    }
    const tsp = parseAmount(ing.amount) ?? 0;
    const existing = seen.get(ing.group!);
    if (existing) {
      existing.amount = String((parseAmount(existing.amount) ?? 0) + tsp);
      continue;
    }
    const line: MealKitIngredient = { name: m[1]!, amount: String(tsp), unit: "sachet" };
    seen.set(ing.group!, line);
    out.push(line);
  }
  // A sachet is about 3 teaspoons of spice
  for (const line of seen.values()) {
    line.amount = String(Math.max(1, Math.round((parseAmount(line.amount) ?? 3) / 3)));
  }
  return out;
}

const BLEND_GROUP = /\(instead of .+\)$/;
const PANTRY_GROUP = /^(pantry|not included( in your (delivery|box))?|you will need|from your cupboard|store cupboard)$/i;

/**
 * Remove groups that aren't real sections. Scans and some pages give each ingredient its own
 * "group" (often its own name, or the previous line's), which shows as a heading per item.
 * Real sections (several items each), blend groups and the pantry group are kept.
 */
export function dropMeaninglessGroups<T extends { name: string; group?: string | null }>(ingredients: T[]): T[] {
  const sizes = new Map<string, number>();
  for (const i of ingredients) if (i.group) sizes.set(i.group, (sizes.get(i.group) ?? 0) + 1);
  const singletons = [...sizes.values()].filter((n) => n === 1).length;
  // Mostly one-item groups: the grouping is noise
  const noisy = singletons >= 3 && singletons >= sizes.size / 2;
  return ingredients.map((i) => {
    if (!i.group) return i;
    const group = i.group.trim().replace(/:$/, "");
    if (BLEND_GROUP.test(group)) return i;
    if (PANTRY_GROUP.test(group)) return { ...i, group: "Pantry" };
    const ownName = group.toLowerCase() === cleanName(i.name).toLowerCase();
    if (ownName || (noisy && sizes.get(i.group) === 1)) {
      const { group: _drop, ...rest } = i;
      return rest as T;
    }
    return i;
  });
}

/** "1 cartons" -> "1 carton": shop units read singular for one. */
function singularUnit(unit: string | undefined, qty: number | null): string | undefined {
  if (!unit || qty === null || qty > 1) return unit;
  const u = unit.toLowerCase();
  if (/^(cartons|sachets|packs|pots|tins|tubs|punnets|pouches|bags|jars|cans|bunches|heads|cloves|balls|trays|nets|boxes|bottles)$/.test(u)) {
    return unit.replace(/(ch|sh|x)es$/i, "$1").replace(/s$/i, "");
  }
  return unit;
}

/** Clean one ingredient list. Returns a new array; the input is not changed. */
export function normalizeMealKitIngredients(
  ingredients: MealKitIngredient[],
  options: MealKitOptions = {}
): MealKitIngredient[] {
  const out: MealKitIngredient[] = [];

  for (const original of dropMeaninglessGroups(ingredients)) {
    const ing: MealKitIngredient = { ...original, name: cleanName(original.name) };
    const unitLower = (ing.unit ?? "").toLowerCase().replace(/\(s\)$/, "").trim();
    const nameLower = ing.name.toLowerCase();

    // "1 unit red onion": unit is a count; metric units get their short spelling
    if (/^units?$/.test(unitLower)) ing.unit = undefined;
    else if (SHORT_UNITS[unitLower]) ing.unit = SHORT_UNITS[unitLower];

    // Bare amounts: "450 potatoes" means 450 g
    const qty = parseAmount(ing.amount);
    ing.unit = singularUnit(ing.unit, qty);
    if (options.bareAmountsAreMetric && !ing.unit && qty !== null && qty >= 10 && !COUNTED.test(nameLower)) {
      ing.unit = LIQUID.test(nameLower) ? "ml" : "g";
    }

    const isSachet = SACHET.test(unitLower) || /\bsachets?\b/.test(nameLower);
    const baseName = nameLower.replace(/\bsachets?(?: of)?\b/g, "").replace(/\s+/g, " ").trim();

    // Stock paste or stock pot sachets -> stock cubes (10 g sachet ≈ 1 cube)
    const stock = STOCK.exec(baseName);
    if (stock) {
      const kind = stock[1] === "veg" ? "vegetable" : stock[1]!;
      const u = (ing.unit ?? "").toLowerCase();
      const cubes = u === "g" || u === "gram" || u === "grams" ? (qty ?? 10) / 10 : (qty ?? 1);
      out.push({ ...ing, name: `${kind} stock cube`, amount: String(Math.max(1, Math.round(cubes))), unit: undefined });
      continue;
    }

    // Pre-mixed blend you can't buy -> its estimated parts (AI first, built-in table as fallback)
    const fromAi = isSachet || unitLower === "g" ? options.blends?.[blendKey(ing.name)] : undefined;
    const tableBlend = BLEND_WORDS.test(baseName) || isSachet ? findBlend(baseName) : undefined;
    const blend = fromAi ?? tableBlend;
    if (blend && !SINGLE_SPICES.test(baseName)) {
      const sachets = sachetCount(ing.amount, ing.unit);
      const group = `${blend.label} (instead of ${ing.name})`;
      for (const part of blend.parts) {
        out.push({ name: part.name, amount: formatTsp(part.tsp * sachets), unit: "tsp", group, category: "pantry" });
      }
      continue;
    }

    // Single-spice sachet -> a teaspoon per sachet
    if (isSachet && SINGLE_SPICES.test(baseName)) {
      out.push({ ...ing, name: baseName, amount: formatTsp(sachetCount(ing.amount, ing.unit)), unit: "tsp", category: ing.category ?? "pantry" });
      continue;
    }

    out.push(ing);
  }

  return out;
}

/** HelloFresh recipe URL (any country site). */
export function isHelloFreshUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return /(^|\.)hellofresh\.[a-z.]+$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
