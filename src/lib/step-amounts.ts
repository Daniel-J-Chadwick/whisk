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

export type StepSegment = { kind: "text"; text: string } | { kind: "amount"; text: string; ingredient: string };

interface Entry {
  label: string;
  amount: string;
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
    entries.push({ label: ing.name, amount, phrases, fullPhrase: full });
  }
  for (const [name, tsp] of blends) {
    const { phrases: all, full } = phrasesFor(name);
    // Blend names overlap everyday words ("salt and pepper"), so require the blend word itself
    const last = full.split(" ").pop() ?? "";
    const phrases = all.filter((p) => p.split(" ").includes(last) && p.includes(" "));
    entries.push({ label: name, amount: `${formatTsp(tsp)} tsp mix`, phrases, fullPhrase: full });
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
  /** Replace this pantry note with the amount, not insert after the name. */
  note?: { start: number; end: number };
}

/** The ingredients a step mentions, in order, with their amounts (for a per-step checklist). */
export function stepIngredients(text: string, ingredients: StepIngredient[]): { label: string; amount: string }[] {
  return annotateStep(text, ingredients)
    .filter((s): s is Extract<StepSegment, { kind: "amount" }> => s.kind === "amount")
    .map((s) => ({ label: s.ingredient, amount: s.text }));
}

export function annotateStep(text: string, ingredients: StepIngredient[]): StepSegment[] {
  const entries = buildEntries(ingredients);
  if (entries.length === 0) return [{ kind: "text", text }];

  const candidates: Match[] = [];
  for (const entry of entries) {
    for (const phrase of entry.phrases) {
      const re = new RegExp(`(?<![\\w-])${escapeRegex(phrase)}(?:e?s)?(?![\\w-])`, "gi");
      for (let m = re.exec(text); m; m = re.exec(text)) {
        candidates.push({ start: m.index, end: m.index + m[0].length, entry, length: phrase.length });
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
  for (let n = PANTRY_NOTE.exec(text); n; n = PANTRY_NOTE.exec(text)) {
    const before = [...chosen].reverse().find((m) => m.end <= n!.index && !m.note);
    if (before) before.note = { start: n.index, end: n.index + n[0].length };
  }
  PANTRY_NOTE.lastIndex = 0;

  const segments: StepSegment[] = [];
  let pos = 0;
  const pushText = (t: string) => {
    if (t) segments.push({ kind: "text", text: t });
  };
  for (const m of chosen) {
    if (m.note) {
      pushText(text.slice(pos, m.note.start));
      segments.push({ kind: "amount", text: m.entry.amount, ingredient: m.entry.label });
      pos = m.note.end;
    } else {
      pushText(text.slice(pos, m.end));
      segments.push({ kind: "amount", text: m.entry.amount, ingredient: m.entry.label });
      pos = m.end;
    }
  }
  pushText(text.slice(pos));
  return segments;
}
