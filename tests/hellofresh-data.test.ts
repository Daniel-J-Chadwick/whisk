import { describe, expect, test } from "bun:test";
import { extractHelloFreshData, parseJsonLdNutrition } from "../functions/lib/hellofresh";
import { applyProductSwaps, swapCandidates } from "../src/lib/mealkit";

const ID = "641889fd6b23cefedf01ca1b";
// Synthetic page in the shape HelloFresh's app data is expected to take (made-up values)
const record = {
  id: ID,
  name: "Test Recipe",
  ingredients: [
    { id: "i1", name: "Potatoes", shipped: true },
    { id: "i2", name: "Hard Italian Style Cheese", shipped: true },
    { id: "i3", name: "Olive Oil", shipped: false },
  ],
  yields: [
    { yields: 2, ingredients: [{ id: "i1", amount: 450, unit: "g" }, { id: "i2", amount: 20, unit: "g" }, { id: "i3", amount: 1, unit: "tbsp" }] },
    { yields: 3, ingredients: [{ id: "i1", amount: 700, unit: "g" }, { id: "i2", amount: 30, unit: "g" }, { id: "i3", amount: 1.5, unit: "tbsp" }] },
    { yields: 4, ingredients: [{ id: "i1", amount: 900, unit: "g" }, { id: "i2", amount: 40, unit: "g" }, { id: "i3", amount: 2, unit: "tbsp" }] },
  ],
  nutrition: [
    { name: "Energy (kJ)", amount: 2400, unit: "kJ" },
    { name: "Energy (kcal)", amount: 575, unit: "kcal" },
    { name: "Fat", amount: 21.3, unit: "g" },
    { name: "of which saturates", amount: 8.1, unit: "g" },
    { name: "Carbohydrate", amount: 64, unit: "g" },
    { name: "of which sugars", amount: 9, unit: "g" },
    { name: "Protein", amount: 33, unit: "g" },
    { name: "Salt", amount: 2.1, unit: "g" },
  ],
  cuisines: [{ name: "British" }],
};
const page = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ssrPayload: { recipe: record } } } })}</script></html>`;

describe("extractHelloFreshData", () => {
  test("reads per-size lists, not-shipped items, nutrition and cuisines", () => {
    const data = extractHelloFreshData(page, ID)!;
    expect([...data.yields.keys()]).toEqual([2, 3, 4]);
    expect(data.yields.get(3)![0]).toEqual({ name: "Potatoes", amount: "700", unit: "g" });
    expect([...data.notShipped]).toEqual(["olive oil"]);
    expect(data.nutrition).toEqual({ calories: 575, fat: 21.3, saturatedFat: 8.1, carbs: 64, sugar: 9, protein: 33, salt: 2.1 });
    expect(data.cuisines).toEqual(["British"]);
  });
  test("a page without app data returns null", () => {
    expect(extractHelloFreshData("<html></html>", ID)).toBeNull();
  });
});

describe("JSON-LD nutrition", () => {
  test("reads schema.org values and converts sodium mg to salt g", () => {
    expect(parseJsonLdNutrition({ calories: "575 kcal", proteinContent: "33 g", sodiumContent: "800 mg" }))
      .toEqual({ calories: 575, protein: 33, salt: 2 });
  });
});

describe("product swaps", () => {
  test("swapped names keep the kit name in brackets; pantry and spices aren't asked about", () => {
    const ings = [
      { name: "Hard Italian Style Cheese", amount: "20", unit: "g" },
      { name: "Olive Oil", amount: "1", unit: "tbsp", group: "Pantry" },
      { name: "ground cumin", amount: "1", unit: "tsp" },
    ];
    expect(swapCandidates(ings)).toEqual(["Hard Italian Style Cheese"]);
    expect(applyProductSwaps(ings, { "hard italian style cheese": "Grana Padano" })[0]!.name).toBe("Grana Padano (Hard Italian Style Cheese)");
  });
});
