import type { TagDefinition, TagGroup } from "../types";

export const PRESET_TAGS: TagDefinition[] = [
  // Meal
  { name: "breakfast", type: "preset", group: "meal", usageCount: 0 },
  { name: "brunch", type: "preset", group: "meal", usageCount: 0 },
  { name: "dinner", type: "preset", group: "meal", usageCount: 0 },
  { name: "salad", type: "preset", group: "meal", usageCount: 0 },
  { name: "dessert", type: "preset", group: "meal", usageCount: 0 },
  { name: "starter", type: "preset", group: "meal", usageCount: 0 },
  { name: "snack", type: "preset", group: "meal", usageCount: 0 },
  { name: "side dish", type: "preset", group: "meal", usageCount: 0 },
  { name: "drinks", type: "preset", group: "meal", usageCount: 0 },

  // Cuisine
  { name: "italian", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "mexican", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "chinese", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "thai", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "indian", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "japanese", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "korean", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "mediterranean", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "american", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "british", type: "preset", group: "cuisine", usageCount: 0 },
  { name: "french", type: "preset", group: "cuisine", usageCount: 0 },

  // Diet
  { name: "vegetarian", type: "preset", group: "diet", usageCount: 0 },
  { name: "vegan", type: "preset", group: "diet", usageCount: 0 },
  { name: "gluten-free", type: "preset", group: "diet", usageCount: 0 },
  { name: "dairy-free", type: "preset", group: "diet", usageCount: 0 },
  { name: "keto", type: "preset", group: "diet", usageCount: 0 },
  { name: "low-carb", type: "preset", group: "diet", usageCount: 0 },
  { name: "healthy", type: "preset", group: "diet", usageCount: 0 },

  // Method
  { name: "bbq", type: "preset", group: "method", usageCount: 0 },
  { name: "baking", type: "preset", group: "method", usageCount: 0 },
  { name: "slow cook", type: "preset", group: "method", usageCount: 0 },
  { name: "pressure cooker", type: "preset", group: "method", usageCount: 0 },
  { name: "one-pot", type: "preset", group: "method", usageCount: 0 },
  { name: "air fryer", type: "preset", group: "method", usageCount: 0 },
  { name: "no-cook", type: "preset", group: "method", usageCount: 0 },
  { name: "stir-fry", type: "preset", group: "method", usageCount: 0 },

  // Speed
  { name: "meal prep", type: "preset", group: "speed", usageCount: 0 },

  // Season
  { name: "summer", type: "preset", group: "season", usageCount: 0 },
  { name: "autumn", type: "preset", group: "season", usageCount: 0 },
  { name: "winter", type: "preset", group: "season", usageCount: 0 },
  { name: "spring", type: "preset", group: "season", usageCount: 0 },
  { name: "christmas", type: "preset", group: "season", usageCount: 0 },
  { name: "bonfire night", type: "preset", group: "season", usageCount: 0 },
  { name: "halloween", type: "preset", group: "season", usageCount: 0 },
  { name: "easter", type: "preset", group: "season", usageCount: 0 },
  { name: "pancake day", type: "preset", group: "season", usageCount: 0 },
  { name: "valentines", type: "preset", group: "season", usageCount: 0 },
  { name: "st patricks", type: "preset", group: "season", usageCount: 0 },
  { name: "burns night", type: "preset", group: "season", usageCount: 0 },
  { name: "new years", type: "preset", group: "season", usageCount: 0 },
  { name: "birthday", type: "preset", group: "season", usageCount: 0 },
];

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  meal: "Meal",
  cuisine: "Cuisine",
  diet: "Diet",
  method: "Method",
  speed: "Speed",
  season: "Season",
  custom: "Custom",
};

export const TAG_GROUP_ORDER: TagGroup[] = [
  "meal",
  "cuisine",
  "diet",
  "method",
  "speed",
  "season",
  "custom",
];

// Time-based filter ranges for the Speed dropdown (filter by actual recipe time, not tags)
export const TIME_RANGES: { label: string; maxMinutes: number }[] = [
  { label: "< 30 min", maxMinutes: 30 },
  { label: "< 45 min", maxMinutes: 45 },
  { label: "< 60 min", maxMinutes: 60 },
  { label: "60+ min", maxMinutes: Infinity },
];

export const PRESET_TAG_NAMES = PRESET_TAGS.map((t) => t.name);

export function getTagsByGroup(
  tags: TagDefinition[]
): Map<TagGroup, TagDefinition[]> {
  const grouped = new Map<TagGroup, TagDefinition[]>();
  for (const group of TAG_GROUP_ORDER) {
    grouped.set(group, []);
  }
  for (const tag of tags) {
    const group = (tag.group ?? "custom") as TagGroup;
    const list = grouped.get(group) ?? [];
    list.push(tag);
    grouped.set(group, list);
  }
  return grouped;
}

/** US tag names (and retired US-only holidays) mapped to UK ones. Applied to new and existing tags. */
export const UK_TAG_ALIASES: Record<string, string> = {
  fall: "autumn",
  appetizer: "starter",
  appetizers: "starter",
  grilling: "bbq",
  "instant pot": "pressure cooker",
};
/** US-only holidays no longer offered as presets (existing uses are kept as custom tags). */
export const RETIRED_PRESET_TAGS = new Set(["thanksgiving", "july 4th", "cinco de mayo"]);

/** UK name for a tag ("fall" -> "autumn"); other tags unchanged. */
export function ukTag(tag: string): string {
  return UK_TAG_ALIASES[tag.toLowerCase().trim()] ?? tag;
}

/** Map a tag list to UK names, removing any duplicates that creates. */
export function ukTags(tags: string[]): string[] {
  return [...new Set(tags.map(ukTag))];
}
