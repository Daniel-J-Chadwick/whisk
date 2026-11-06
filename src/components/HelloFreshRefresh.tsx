import { useState } from "react";
import type { Ingredient, Recipe, RecipeIndexEntry, RecipePhoto, Step } from "../types";
import { api } from "../lib/api";
import { CACHE_KEYS, setLocal } from "../lib/cache";
import {
  applyProductSwaps,
  collapseEstimatedBlends,
  findBlendSachets,
  swapCandidates,
  isHelloFreshUrl,
  looksLikeMealKit,
  normalizeMealKitIngredients,
  type BlendRecipe,
} from "../lib/mealkit";
import { Button } from "./ui/Button";
import { PRESET_TAGS } from "../lib/tags";

// Cuisine tags come from HelloFresh on re-import; earlier guesses are replaced
const CUISINE_TAG_NAMES = new Set(PRESET_TAGS.filter((t) => t.group === "cuisine").map((t) => t.name));

interface ImportedRecipe {
  title?: string;
  description?: string;
  ingredients?: Ingredient[];
  steps?: Step[];
  photos?: RecipePhoto[];
  thumbnailUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
  servingIngredients?: Recipe["servingIngredients"];
  nutrition?: Recipe["nutrition"];
}

/** Earlier split of a spice sachet into estimated spices. */
const hasEstimatedBlend = (ingredients: Ingredient[]) => ingredients.some((i) => /\(instead of .+\)$/.test(i.group ?? ""));

/** Three or more unitless amounts of 10+ ("450 potatoes"): a meal-kit list that lost its units. */
function hasBareMetricAmounts(ingredients: Ingredient[]): boolean {
  return ingredients.filter((i) => !i.unit && /^\d+(\.\d+)?$/.test((i.amount ?? "").trim()) && Number(i.amount) >= 10).length >= 3;
}

function isHelloFreshRecipe(r: Recipe): boolean {
  return (
    isHelloFreshUrl(r.source?.url) ||
    /hellofresh/i.test(r.source?.attribution ?? "") ||
    looksLikeMealKit(r.ingredients) ||
    hasEstimatedBlend(r.ingredients) ||
    hasBareMetricAmounts(r.ingredients)
  );
}

/**
 * Re-imports every HelloFresh recipe in the book with the current importer:
 * recipes with a HelloFresh link are fetched again (fresh ingredients, steps and step photos);
 * scanned ones have their stored ingredients cleaned up. Notes, tags, favourites and cook
 * history are kept.
 */
export function HelloFreshRefresh() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setSummary(null);
    let refetched = 0;
    let cleaned = 0;
    let unchanged = 0;
    let withSizes = 0;
    let withNutrition = 0;
    const failed: string[] = [];
    try {
      setProgress("Finding HelloFresh recipes...");
      const index = await api.get<RecipeIndexEntry[]>("/recipes");
      const recipes: Recipe[] = [];
      for (const entry of index) {
        try {
          const r = await api.get<Recipe>(`/recipes/${entry.id}`);
          if (isHelloFreshRecipe(r)) recipes.push(r);
        } catch {
          // Skip recipes that fail to load
        }
      }

      for (const [i, recipe] of recipes.entries()) {
        setProgress(`Updating ${i + 1} of ${recipes.length}: ${recipe.title}`);
        let updates: Partial<Recipe> | null = null;

        if (isHelloFreshUrl(recipe.source?.url)) {
          try {
            const data = await api.post<ImportedRecipe>(
              "/import/url",
              { url: recipe.source!.url, downloadImage: true },
              { timeoutMs: 60000 }
            );
            if (data.ingredients?.length && data.steps?.length) {
              updates = {
                title: data.title || recipe.title,
                description: data.description || recipe.description,
                ingredients: data.ingredients,
                steps: data.steps,
                ...(data.photos?.length ? { photos: data.photos } : {}),
                ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
                ...(data.prepTime ? { prepTime: data.prepTime } : {}),
                ...(data.cookTime ? { cookTime: data.cookTime } : {}),
                ...(data.servings ? { servings: data.servings } : {}),
                ...(data.servingIngredients ? { servingIngredients: data.servingIngredients } : {}),
                ...(data.nutrition ? { nutrition: data.nutrition } : {}),
                // Keep your own tags; replace cuisine tags with HelloFresh's
                tags: [...new Set([
                  ...recipe.tags.filter((t) => !CUISINE_TAG_NAMES.has(t)),
                  ...(data.tags ?? []).filter((t) => CUISINE_TAG_NAMES.has(t) || !recipe.tags.includes(t)),
                ])],
              };
              refetched++;
              if (data.servingIngredients && Object.keys(data.servingIngredients).length) withSizes++;
              if (data.nutrition) withNutrition++;
            }
          } catch {
            // Fall back to cleaning what's stored
          }
        }

        if (!updates) {
          // Undo any earlier table-based blend split, then let the AI work out each sachet
          const collapsed = collapseEstimatedBlends(recipe.ingredients);
          const blendNames = findBlendSachets(collapsed);
          let blends: Record<string, BlendRecipe> = {};
          if (blendNames.length) {
            try {
              blends = (await api.post<{ blends: Record<string, BlendRecipe> }>(
                "/ai/spice-blends",
                { names: blendNames, title: recipe.title },
                { timeoutMs: 60000 }
              )).blends;
            } catch {
              // Fall back to the built-in estimates
            }
          }
          const normalized = normalizeMealKitIngredients(collapsed, { bareAmountsAreMetric: true, markPantry: true, blends });
          // Supermarket names for kit-only products
          let swaps: Record<string, string> = {};
          const candidates = swapCandidates(normalized);
          if (candidates.length) {
            try {
              swaps = (await api.post<{ swaps: Record<string, string> }>(
                "/ai/product-swaps",
                { names: candidates, title: recipe.title },
                { timeoutMs: 60000 }
              )).swaps;
            } catch {
              // Keep the kit's names
            }
          }
          const ingredients = applyProductSwaps(normalized, swaps) as Ingredient[];
          if (JSON.stringify(ingredients) === JSON.stringify(recipe.ingredients)) {
            unchanged++;
            continue;
          }
          updates = { ingredients };
          cleaned++;
        }

        try {
          const saved = await api.put<Recipe>(`/recipes/${recipe.id}`, updates);
          setLocal(CACHE_KEYS.RECIPE(recipe.id), saved);
        } catch {
          failed.push(recipe.title);
        }
      }

      const parts = [
        `${recipes.length} HelloFresh recipe${recipes.length === 1 ? "" : "s"} found`,
        refetched ? `${refetched} re-imported from HelloFresh` : "",
        cleaned ? `${cleaned} cleaned up` : "",
        unchanged ? `${unchanged} already up to date` : "",
        refetched ? `exact 3 and 4 person amounts for ${withSizes} of ${refetched}` : "",
        refetched ? `nutrition for ${withNutrition} of ${refetched}` : "",
        failed.length ? `couldn't save: ${failed.join(", ")}` : "",
      ].filter(Boolean);
      setSummary(`${parts.join(". ")}. Re-add recipes to your shopping list to pick up the changes.`);
    } catch (err) {
      setSummary(`Re-import stopped: ${err instanceof Error ? err.message : "something went wrong"}`);
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="secondary" fullWidth onClick={run} disabled={running}>
        {running ? "Re-importing..." : "Re-import HelloFresh recipes"}
      </Button>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {progress ||
          summary ||
          "Fetches HelloFresh recipes again with the latest importer: units fixed, spice sachets worked out as everyday spices, kit-only products given supermarket names, pantry items marked, nutrition and 3–4 person amounts added where HelloFresh has them. Your notes, tags and favourites are kept."}
      </p>
    </div>
  );
}
