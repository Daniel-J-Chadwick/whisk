/**
 * Likely leftovers from a week's shopping: perishable things sold in fixed packs where the
 * planned recipes use only part of a pack ("80 g of a 200 g bag of spinach"), with other
 * recipes from the book that could use the rest.
 *
 * Pack sizes are typical UK supermarket sizes, so the numbers are estimates.
 */

export interface LeftoverItemInput {
  name: string;
  amount?: string;
  unit?: string;
}

export interface LeftoverRecipe {
  id: string;
  title: string;
  ingredientNames?: string[];
  favorite?: boolean;
  wantToMake?: boolean;
}

export interface Leftover {
  /** Display name, e.g. "Baby spinach". */
  label: string;
  /** What the plan uses, e.g. "80 g". */
  used: string;
  /** What you'd buy, e.g. "1 × 200 g bag". */
  buy: string;
  /** Roughly what's left, e.g. "120 g". */
  left: string;
  /** Other recipes in the book that use it. */
  suggestions: { id: string; title: string }[];
}

type Measure = "g" | "ml" | "count";

interface Pack {
  label: string;
  match: RegExp;
  measure: Measure;
  sizes: number[];
  container: string;
  /** Finds recipes that use it. */
  uses: RegExp;
}

const PACKS: Pack[] = [
  { label: "Baby spinach", match: /\bspinach\b/, measure: "g", sizes: [100, 200, 260], container: "bag", uses: /\bspinach\b/ },
  { label: "Salad leaves", match: /\b(baby leaf|salad leaves|leaf mix|mixed leaves|rocket|watercress)\b/, measure: "g", sizes: [80, 120], container: "bag", uses: /\b(baby leaf|salad|leaves|rocket|watercress)\b/ },
  { label: "Mushrooms", match: /\bmushrooms?\b(?!.*paste)/, measure: "g", sizes: [250, 400], container: "punnet", uses: /\bmushrooms?\b/ },
  { label: "Cherry tomatoes", match: /\b(cherry|baby plum|grape) tomato/, measure: "g", sizes: [250, 330], container: "punnet", uses: /\b(cherry|plum|grape)? ?tomato/ },
  { label: "Green beans", match: /\bgreen beans?\b/, measure: "g", sizes: [200, 220], container: "pack", uses: /\bgreen beans?\b/ },
  { label: "Tenderstem broccoli", match: /\btenderstem\b/, measure: "g", sizes: [200], container: "pack", uses: /\b(tenderstem|broccoli)\b/ },
  { label: "Spring onions", match: /\bspring onions?\b/, measure: "count", sizes: [7], container: "bunch", uses: /\bspring onions?\b/ },
  { label: "Peppers", match: /\b(bell )?peppers?\b(?!.*(corn|flakes|ground|black|white|sauce|chilli))/, measure: "count", sizes: [3], container: "pack", uses: /\b(bell )?peppers?\b/ },
  { label: "Coriander", match: /\bcoriander\b(?!.*(ground|seed))/, measure: "g", sizes: [30], container: "pack", uses: /\bcoriander\b/ },
  { label: "Crème fraîche", match: /\bcr[eè]me fra[iî]che\b/, measure: "ml", sizes: [200, 300], container: "pot", uses: /\bcr[eè]me fra[iî]che\b/ },
  { label: "Soured cream", match: /\bsou?r(ed)? cream\b/, measure: "ml", sizes: [150, 300], container: "pot", uses: /\bsou?r(ed)? cream\b/ },
  { label: "Double cream", match: /\bdouble cream\b/, measure: "ml", sizes: [150, 300], container: "pot", uses: /\b(double|single|whipping) cream\b/ },
  { label: "Greek yoghurt", match: /\b(greek|natural) (style )?yog(h)?urt\b/, measure: "g", sizes: [150, 500], container: "pot", uses: /\byog(h)?urt\b/ },
  { label: "Cheddar", match: /\bcheddar\b/, measure: "g", sizes: [200, 400], container: "block", uses: /\bcheddar\b/ },
  { label: "Mozzarella", match: /\bmozzarella\b/, measure: "g", sizes: [125], container: "ball", uses: /\bmozzarella\b/ },
  { label: "Feta", match: /\bfeta\b/, measure: "g", sizes: [200], container: "pack", uses: /\bfeta\b/ },
  { label: "Halloumi", match: /\bhalloumi\b/, measure: "g", sizes: [225, 250], container: "block", uses: /\bhalloumi\b/ },
  { label: "Hard Italian cheese", match: /\b(parmesan|grana padano|hard italian)/, measure: "g", sizes: [100, 200], container: "wedge", uses: /\b(parmesan|grana padano|hard italian)/ },
  { label: "Beef mince", match: /\bbeef mince\b|\bminced beef\b/, measure: "g", sizes: [250, 500, 750], container: "pack", uses: /\b(beef mince|minced beef|mince)\b/ },
  { label: "Pork mince", match: /\bpork mince\b|\bminced pork\b/, measure: "g", sizes: [500], container: "pack", uses: /\bpork mince\b/ },
  { label: "Chicken breast", match: /\bchicken breasts?\b(?!.*(mini|fillets))/, measure: "g", sizes: [300, 600], container: "pack", uses: /\bchicken breasts?\b/ },
  { label: "Chicken thighs", match: /\bchicken thighs?\b/, measure: "g", sizes: [500, 1000], container: "pack", uses: /\bchicken thighs?\b/ },
  { label: "Bacon", match: /\bbacon\b|\blardons\b/, measure: "g", sizes: [200, 300], container: "pack", uses: /\b(bacon|lardons|pancetta)\b/ },
  { label: "Chorizo", match: /\bchorizo\b/, measure: "g", sizes: [130, 225], container: "pack", uses: /\bchorizo\b/ },
  { label: "Coconut milk", match: /\bcoconut milk\b/, measure: "ml", sizes: [400], container: "tin", uses: /\bcoconut (milk|cream)\b/ },
  { label: "Passata", match: /\bpassata\b/, measure: "g", sizes: [500], container: "carton", uses: /\b(passata|tomato sauce)\b/ },
  { label: "Chopped tomatoes", match: /\bchopped tomatoes\b/, measure: "g", sizes: [400], container: "tin", uses: /\bchopped tomatoes\b/ },
  { label: "Pesto", match: /\bpesto\b/, measure: "g", sizes: [190], container: "jar", uses: /\bpesto\b/ },
  { label: "Tortilla wraps", match: /\b(tortillas?|wraps?)\b/, measure: "count", sizes: [8], container: "pack", uses: /\b(tortillas?|wraps?|fajitas?|burritos?|quesadillas?)\b/ },
  { label: "Fresh pasta", match: /\b(fresh (pasta|tagliatelle|linguine)|tortell?[io]ni|ravioli)\b/, measure: "g", sizes: [250, 300], container: "pack", uses: /\b(tagliatelle|linguine|tortell?[io]ni|ravioli|pasta)\b/ },
  { label: "Gnocchi", match: /\bgnocchi\b/, measure: "g", sizes: [500], container: "pack", uses: /\bgnocchi\b/ },
  { label: "Egg noodles", match: /\begg noodles?\b|\bnoodle nests?\b/, measure: "g", sizes: [250, 300], container: "pack", uses: /\bnoodles?\b/ },
];

function parseQty(amount: string | undefined): number | null {
  if (!amount) return null;
  let total = 0;
  let any = false;
  for (const part of amount.trim().replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").trim().split(/\s+/)) {
    const frac = /^(\d+)\/(\d+)$/.exec(part);
    if (frac) {
      total += Number(frac[1]) / Number(frac[2]);
      any = true;
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part);
      any = true;
    } else return null;
  }
  return any ? total : null;
}

/** Amount in the pack's measure, or null if it can't be compared (e.g. "1 bunch", "1 tbsp"). */
function measureOf(item: LeftoverItemInput, measure: Measure): number | null {
  const qty = parseQty(item.amount);
  if (qty === null || qty <= 0) return null;
  const u = (item.unit ?? "").toLowerCase().trim();
  if (measure === "count") return u === "" ? qty : null;
  if (u === "g" || u === "ml") return qty; // treat ml and g as interchangeable for dairy and sauces
  if (u === "kg" || u === "l") return qty * 1000;
  return null;
}

function fmt(n: number, measure: Measure): string {
  const rounded = n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  return measure === "count" ? String(rounded) : `${rounded} ${measure}`;
}

export function findLeftovers(
  items: LeftoverItemInput[],
  recipes: LeftoverRecipe[] = [],
  plannedIds: string[] = []
): Leftover[] {
  const totals = new Map<Pack, number>();
  for (const item of items) {
    const name = item.name.toLowerCase();
    const pack = PACKS.find((p) => p.match.test(name));
    if (!pack) continue;
    const need = measureOf(item, pack.measure);
    if (need === null) continue;
    totals.set(pack, (totals.get(pack) ?? 0) + need);
  }

  const planned = new Set(plannedIds);
  const results: Leftover[] = [];
  for (const [pack, need] of totals) {
    const fits = pack.sizes.find((s) => s >= need);
    const size = fits ?? pack.sizes[pack.sizes.length - 1]!;
    const count = fits ? 1 : Math.ceil(need / size);
    const left = size * count - need;
    // Worth mentioning: at least a quarter of a pack and a meaningful amount
    const minimum = pack.measure === "count" ? 1 : 20;
    if (left < minimum || left / size < 0.25) continue;

    const suggestions = recipes
      .filter((r) => !planned.has(r.id) && (r.ingredientNames ?? []).some((n) => pack.uses.test(n.toLowerCase())))
      .sort((a, b) => Number(!!b.wantToMake) - Number(!!a.wantToMake) || Number(!!b.favorite) - Number(!!a.favorite))
      .slice(0, 3)
      .map((r) => ({ id: r.id, title: r.title }));

    const sizeText = pack.measure === "count" ? `${size}` : `${size} ${pack.measure}`;
    results.push({
      label: pack.label,
      used: fmt(need, pack.measure),
      buy: pack.measure === "count" ? `${count} ${pack.container}${count > 1 ? "s" : ""} of ${sizeText}` : `${count} × ${sizeText} ${pack.container}`,
      left: fmt(left, pack.measure),
      suggestions,
    });
  }
  // Largest amounts left first
  return results.sort((a, b) => parseFloat(b.left) - parseFloat(a.left));
}
