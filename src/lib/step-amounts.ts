/**
 * Show ingredient amounts inside step text: "add the passata" -> "add the passata [1 carton]".
 *
 * Works on whatever ingredient list it's given, so passing the scaled ingredients
 * (Whisk's ½×–4× scaler) gives scaled amounts in the steps. Display only: the stored
 * step text never changes.
 *
 * - Each ingredient is marked at its first mention in a step, matched by its full name or a
 *   distinctive part of it ("British Pork and Oregano Sausage Meat" -> "sausage meat").
 * - "(see pantry for amount)" is replaced by the amount of the ingredient just before it.
 * - Spice blends split into parts are matched by the sachet's original name and shown as one
 *   total ("2 1/4 tsp mix").
 * - Mentions that already have an amount in front ("0.5 tsp salt") are left alone.
 */

import { formatTsp } from "./mealkit";

export interface StepIngredient {
  name: string;
  amount?: string;
  unit?: string;
  group?: string;
}

export type StepSegment =
  | { kind: "text"; text: string }
  /** quiet: a bare count of 1 ("the onion"), listed in checklists but not shown inline. */
  | { kind: "amount"; text: string; ingredient: string; quiet?: boolean };

interface Entry {
  label: string;
  amount: string;
  /** A bare count of 1 or less: obvious from the text, so not shown inline. */
  quiet: boolean;
  phrases: string[];
  fullPhrase: string;
}

// Words that don't identify an ingredient on their own
const NOISE = new Set([
  "a", "an", "and", "the", "of", "for", "with", "in", "or", "to", "your",
  "british", "fresh", "mature", "style", "italian", "free", "range", "outdoor", "bred", "our", "large", "small", "medium",
  "unit", "units", "sachet", "sachets", "pack", "pot",
]);
// Single words too vague to match on their own (they'd catch "salt and pepper", "drizzle of oil")
const AMBIGUOUS = new Set([
  "pepper", "oil", "salt", "water", "sauce", "paste", "cheese", "stock", "mix", "leaf", "leaves", "seasoning", "spice",
  "powder", "cream", "meat", "white", "red", "green", "black", "baby", "sweet", "hot", "ground", "dried", "clove", "cloves",
  "zest", "juice", "chunks", "slices", "fillets", "mini", "part", "glaze",
]);

function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-zà-ÿ'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Contiguous word runs from a name that identify it, longest first. */
function phrasesFor(name: string): { phrases: string[]; full: string } {
  const all = words(name);
  const full = all.join(" ");
  const phrases = new Set<string>([full]);
  for (let len = Math.min(all.length, 4); len >= 1; len--) {
    for (let i = 0; i + len <= all.length; i++) {
      const run = all.slice(i, i + len);
      if (NOISE.has(run[0]!) || NOISE.has(run[run.length - 1]!)) continue;
      if (run.every((w) => NOISE.has(w))) continue;
      if (len === 1 && (AMBIGUOUS.has(run[0]!) || run[0]!.length < 3)) continue;
      phrases.add(run.join(" "));
    }
  }
  return { phrases: [...phrases].sort((a, b) => b.length - a.length), full };
}

function amountText(ing: StepIngredient): string {
  return [ing.amount, ing.unit].filter((s) => s && s.trim()).join(" ").trim();
}

function parseTsp(amount: string | undefined): number {
  if (!amount) return 0;
  let total = 0;
  for (const part of amount.trim().split(/\s+/)) {
    const frac = /^(\d+)\/(\d+)$/.exec(part);
    if (frac) total += Number(frac[1]) / Number(frac[2]);
    else if (/^\d+(\.\d+)?$/.test(part)) total += Number(part);
  }
  return total;
}

function buildEntries(ingredients: StepIngredient[]): Entry[] {
  const entries: Entry[] = [];
  const blends = new Map<string, number>();
  for (const ing of ingredients) {
    const blend = /\(instead of (.+)\)$/.exec(ing.group ?? "");
    if (blend) {
      blends.set(blend[1]!, (blends.get(blend[1]!) ?? 0) + parseTsp(ing.amount));
      continue;
    }
    const amount = amountText(ing);
    if (!amount) continue;
    const { phrases, full } = phrasesFor(ing.name);
    const quiet = !ing.unit?.trim() && parseTsp(ing.amount) <= 1;
    entries.push({ label: ing.name, amount, quiet, phrases, fullPhrase: full });
  }
  for (const [name, tsp] of blends) {
    const { phrases: all, full } = phrasesFor(name);
    // Blend names overlap everyday words ("salt and pepper"), so require the blend word itself
    const last = full.split(" ").pop() ?? "";
    const phrases = all.filter((p) => p.split(" ").includes(last) && p.includes(" "));
    entries.push({ label: name, amount: `${formatTsp(tsp)} tsp mix`, quiet: false, phrases, fullPhrase: full });
  }

  // A phrase shared by two ingredients only counts for the one it fully names ("onion" vs "spring onion")
  const owners = new Map<string, Entry[]>();
  for (const e of entries) for (const p of e.phrases) owners.set(p, [...(owners.get(p) ?? []), e]);
  for (const e of entries) {
    e.phrases = e.phrases.filter((p) => {
      const o = owners.get(p)!;
      return o.length === 1 || e.fullPhrase === p;
    });
  }
  return entries;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

const PANTRY_NOTE = /\s*\(see pantry for amount\)/gi;
const AMOUNT_BEFORE = /(\d[\d\s./½¼¾⅓⅔-]*\s*(?:[a-z]+\s+)?(?:of\s+)?)$/i;

interface Match {
  start: number;
  end: number;
  entry: Entry;
  length: number;
  /** Matched on part of the name ("chicken" for "chicken mini fillets"). */
  partial?: boolean;
  /** Replace this pantry note with the amount, not insert after the name. */
  note?: { start: number; end: number };
}

// After a part-name match: the same ingredient in another form (tag after it) ...
const SAME_THING_AFTER = /^\s+(tenders|fillets|strips|slices|pieces|chunks|wedges|chips|cubes|florets|rings)\b/i;
// ... or something made from it, which shouldn't get the raw ingredient's amount
const MADE_FROM_AFTER = /^\s+(sauce|mixture|dressing|gravy|mash|marinade|batter|crumb|crust|topping|filling)\b/i;

/** The ingredients a step mentions, in order, with their amounts (for a per-step checklist). */
export function stepIngredients(text: string, ingredients: StepIngredient[]): { label: string; amount: string }[] {
  return annotateStep(text, ingredients)
    .filter((s): s is Extract<StepSegment, { kind: "amount" }> => s.kind === "amount")
    .map((s) => ({ label: s.ingredient, amount: s.text }));
}

/** How much of each ingredient earlier steps used, for "the remaining ...". */
export interface StepState {
  used: Map<string, number>;
}

/**
 * Annotate a recipe's steps in order. "Two thirds of the seasoning" in one step and
 * "the remaining seasoning" in a later one show 2/3 and 1/3 of the amount.
 */
export function annotateSteps(texts: string[], ingredients: StepIngredient[]): StepSegment[][] {
  const state: StepState = { used: new Map() };
  return texts.map((t) => annotateStep(t, ingredients, state));
}

/** Ingredients listed in annotated segments (for the cook mode checklist). */
export function segmentIngredients(segments: StepSegment[]): { label: string; amount: string }[] {
  return segments
    .filter((s): s is Extract<StepSegment, { kind: "amount" }> => s.kind === "amount")
    .map((s) => ({ label: s.ingredient, amount: s.text }));
}

// "half the", "two thirds of the", "a quarter of", "the remaining", "the rest of the" right before a mention
const FRACTION_BEFORE =
  /\b(half|a half|one half|two thirds|2\/3|a third|one third|1\/3|a quarter|one quarter|1\/4|three quarters|3\/4|the remaining|remaining|the rest)\s+(?:of\s+)?(?:the\s+|your\s+)?$/i;
const FRACTIONS: Record<string, number> = {
  half: 0.5, "a half": 0.5, "one half": 0.5,
  "two thirds": 2 / 3, "2/3": 2 / 3, "a third": 1 / 3, "one third": 1 / 3, "1/3": 1 / 3,
  "a quarter": 0.25, "one quarter": 0.25, "1/4": 0.25, "three quarters": 0.75, "3/4": 0.75,
};

/** "3 tsp mix" × 2/3 -> "2 tsp mix"; "450 g" × 0.5 -> "225 g". */
export function scaleAmountText(amount: string, factor: number): string {
  const m = /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)(.*)$/.exec(amount.trim());
  if (!m) return amount;
  const value = parseTsp(m[1]) * factor;
  const rest = m[2] ?? "";
  let text: string;
  if (/^\s*(tsp|tbsp)\b/.test(rest) || value < 10) text = formatTsp(value);
  else if (value >= 50) text = String(Math.round(value / 5) * 5);
  else text = String(Math.round(value));
  return `${text}${rest}`;
}

export function annotateStep(text: string, ingredients: StepIngredient[], state?: StepState): StepSegment[] {
  const entries = buildEntries(ingredients);
  if (entries.length === 0) return [{ kind: "text", text }];

  const candidates: Match[] = [];
  for (const entry of entries) {
    for (const phrase of entry.phrases) {
      // Names store "&" as "and"; match either in the step text
      const re = new RegExp(`(?<![\\w-])${escapeRegex(phrase).replace(/\band\b/g, "(?:and|&)")}(?:e?s)?(?![\\w-])`, "gi");
      for (let m = re.exec(text); m; m = re.exec(text)) {
        candidates.push({ start: m.index, end: m.index + m[0].length, entry, length: phrase.length, partial: phrase !== entry.fullPhrase });
      }
    }
  }

  // Longest phrases first, then earliest; one mark per ingredient, no overlaps
  candidates.sort((a, b) => b.length - a.length || a.start - b.start);
  const chosen: Match[] = [];
  const used = new Set<Entry>();
  for (const c of candidates) {
    if (used.has(c.entry)) continue;
    if (chosen.some((m) => c.start < m.end && m.start < c.end)) continue;
    if (c.partial) {
      const after = text.slice(c.end);
      if (MADE_FROM_AFTER.test(after)) continue; // "katsu sauce" isn't the katsu paste
      const same = SAME_THING_AFTER.exec(after);
      if (same) c.end += same[0].length; // "chicken tenders [270 g]"
    }
    // Already has an amount right in front ("0.5 tsp salt", "2 garlic cloves")
    if (AMOUNT_BEFORE.test(text.slice(Math.max(0, c.start - 14), c.start))) {
      used.add(c.entry);
      continue;
    }
    chosen.push(c);
    used.add(c.entry);
  }
  chosen.sort((a, b) => a.start - b.start);

  // "(see pantry for amount)" takes the amount of the ingredient just before it
  // "(see pantry for amount)" belongs to the word(s) right before it: either a match that ends
  // there, or an ingredient whose name starts with those words ("salt" -> "Salt for the Breadcrumbs").
  for (let n = PANTRY_NOTE.exec(text); n; n = PANTRY_NOTE.exec(text)) {
    const note = { start: n.index, end: n.index + n[0].length };
    const adjacent = chosen.find((m) => !m.note && m.end <= note.start && /^\s*$/.test(text.slice(m.end, note.start)));
    if (adjacent) {
      adjacent.note = note;
      continue;
    }
    const tail = words(text.slice(Math.max(0, note.start - 40), note.start)).slice(-3);
    for (let k = tail.length; k >= 1; k--) {
      const lead = tail.slice(-k).join(" ");
      const entry = entries.find((e) => e.fullPhrase === lead || e.fullPhrase.startsWith(`${lead} `));
      if (entry) {
        chosen.push({ start: note.start, end: note.start, entry, length: lead.length, note });
        break;
      }
    }
  }
  PANTRY_NOTE.lastIndex = 0;
  chosen.sort((a, b) => a.start - b.start);

  const segments: StepSegment[] = [];
  let pos = 0;
  const pushText = (t: string) => {
    if (t) segments.push({ kind: "text", text: t });
  };
  /** The amount for this mention, cut down when the text says "half the", "the remaining" and so on. */
  const amountFor = (m: Match): string => {
    const before = FRACTION_BEFORE.exec(text.slice(Math.max(0, m.start - 30), m.start));
    const used = state?.used.get(m.entry.label) ?? 0;
    if (!before) return m.entry.amount;
    const word = before[1]!.toLowerCase();
    if (/remaining|rest/.test(word)) {
      state?.used.set(m.entry.label, 1);
      return used > 0 && used < 1 ? scaleAmountText(m.entry.amount, 1 - used) : m.entry.amount;
    }
    const f = FRACTIONS[word];
    if (!f) return m.entry.amount;
    state?.used.set(m.entry.label, Math.min(1, used + f));
    return scaleAmountText(m.entry.amount, f);
  };

  for (const m of chosen) {
    if (m.note) {
      pushText(text.slice(pos, m.note.start));
      segments.push({ kind: "amount", text: m.entry.amount, ingredient: m.entry.label, quiet: m.entry.quiet });
      pos = m.note.end;
    } else {
      pushText(text.slice(pos, m.end));
      segments.push({ kind: "amount", text: amountFor(m), ingredient: m.entry.label, quiet: m.entry.quiet });
      pos = m.end;
    }
  }
  pushText(text.slice(pos));
  return segments;
}
