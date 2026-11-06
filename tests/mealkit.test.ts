import { describe, expect, test } from "bun:test";
import { formatTsp, isHelloFreshUrl, looksLikeMealKit, normalizeMealKitIngredients } from "../src/lib/mealkit";

const norm = (ings: { name: string; amount?: string; unit?: string }[]) =>
  normalizeMealKitIngredients(ings, { bareAmountsAreMetric: true });

describe("normalizeMealKitIngredients", () => {
  test("bare amounts become grams, liquids millilitres, counts stay", () => {
    const out = norm([
      { name: "Potatoes", amount: "450" },
      { name: "Tomatoes", amount: "125" },
      { name: "Balsamic Glaze", amount: "12" },
      { name: "Eggs", amount: "12" },
      { name: "Chicken Breasts", amount: "2" },
    ]);
    expect(out.map((i) => i.unit)).toEqual(["g", "g", "ml", undefined, undefined]);
  });
  test("'unit' is a count", () => {
    expect(norm([{ name: "Red Onion", amount: "1", unit: "unit" }])[0]!.unit).toBeUndefined();
  });
  test("blend sachets split into grouped everyday spices", () => {
    const out = norm([{ name: "Central American Style Spice", amount: "1", unit: "sachet" }]);
    expect(out.length).toBeGreaterThan(3);
    expect(out.every((i) => i.unit === "tsp" && i.group?.includes("Central American Style Spice"))).toBe(true);
    expect(out.map((i) => i.name)).toContain("ground cumin");
  });
  test("two sachets double the spices", () => {
    const one = norm([{ name: "Cajun Spice Mix", amount: "1", unit: "sachet" }]);
    const two = norm([{ name: "Cajun Spice Mix", amount: "2", unit: "sachets" }]);
    expect(one[0]!.amount).toBe("1");
    expect(two[0]!.amount).toBe("2");
  });
  test("single spices sold on their own become teaspoons, not blends", () => {
    expect(norm([{ name: "Chinese Five Spice", amount: "1", unit: "sachet" }])).toEqual([
      { name: "chinese five spice", amount: "1", unit: "tsp", category: "pantry" },
    ]);
  });
  test("stock paste becomes stock cubes", () => {
    expect(norm([{ name: "Chicken Stock Paste", amount: "20", unit: "g" }])[0]).toMatchObject({ name: "chicken stock cube", amount: "2" });
    expect(norm([{ name: "Vegetable Stock Paste", amount: "1", unit: "sachet" }])[0]).toMatchObject({ name: "vegetable stock cube", amount: "1" });
  });
  test("running twice changes nothing", () => {
    const once = norm([
      { name: "Central American Style Spice", amount: "1", unit: "sachet" },
      { name: "Potatoes", amount: "450" },
    ]);
    expect(norm(once)).toEqual(once);
  });
});

describe("helpers", () => {
  test("formatTsp rounds to quarters", () => {
    expect(formatTsp(1.25)).toBe("1 1/4");
    expect(formatTsp(0.5)).toBe("1/2");
    expect(formatTsp(0.1)).toBe("1/4");
  });
  test("detection", () => {
    expect(isHelloFreshUrl("https://www.hellofresh.co.uk/recipes/x-641889fd6b23cefedf01ca1b")).toBe(true);
    expect(isHelloFreshUrl("https://www.bbcgoodfood.com/recipes/x")).toBe(false);
    expect(looksLikeMealKit([{ name: "Stock paste", unit: "sachet" }])).toBe(true);
    expect(looksLikeMealKit([{ name: "Flour", amount: "200", unit: "g" }])).toBe(false);
  });
});
