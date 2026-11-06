import { describe, expect, test } from "bun:test";
import { blendKey, collapseEstimatedBlends, findBlendSachets, formatTsp, isHelloFreshUrl, looksLikeMealKit, normalizeMealKitIngredients } from "../src/lib/mealkit";

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

describe("AI blends", () => {
  const aiBlend = { label: "Smoky taco mix", parts: [{ name: "ancho chilli powder", tsp: 1.5 }, { name: "ground cumin", tsp: 1 }, { name: "dried oregano", tsp: 0.5 }] };
  test("finds blend sachets but not single spices or stock", () => {
    expect(findBlendSachets([
      { name: "Central American Style Spice", amount: "1", unit: "sachet" },
      { name: "Chinese Five Spice", amount: "1", unit: "sachet" },
      { name: "Chicken Stock Paste", amount: "1", unit: "sachet" },
      { name: "Bold Spice Blend", amount: "3", unit: "g" },
      { name: "Flour", amount: "200", unit: "g" },
    ])).toEqual(["Central American Style Spice", "Bold Spice Blend"]);
  });
  test("the AI's recipe beats the built-in table", () => {
    const out = normalizeMealKitIngredients(
      [{ name: "Central American Style Spice", amount: "2", unit: "sachet" }],
      { blends: { [blendKey("Central American Style Spice")]: aiBlend } }
    );
    expect(out.map((i) => `${i.amount} ${i.name}`)).toEqual(["3 ancho chilli powder", "2 ground cumin", "1 dried oregano"]);
    expect(out[0]!.group).toBe("Smoky taco mix (instead of Central American Style Spice)");
  });
  test("a blend unknown to the table is split only when the AI knows it", () => {
    const ing = [{ name: "Bold Spice Blend", amount: "1", unit: "sachet" }];
    expect(normalizeMealKitIngredients(ing)).toHaveLength(1);
    expect(normalizeMealKitIngredients(ing, { blends: { [blendKey("Bold Spice Blend")]: aiBlend } })).toHaveLength(3);
  });
  test("an earlier split collapses back to sachets so it can be redone", () => {
    const split = normalizeMealKitIngredients([
      { name: "Cajun Spice Mix", amount: "2", unit: "sachet" },
      { name: "Potatoes", amount: "450", unit: "g" },
    ]);
    expect(collapseEstimatedBlends(split)).toEqual([
      { name: "Cajun Spice Mix", amount: "2", unit: "sachet" },
      { name: "Potatoes", amount: "450", unit: "g" },
    ]);
  });
});

describe("HelloFresh (s) wording", () => {
  test("unit(s), milliliter(s) and sachet(s) parse as units, not names", async () => {
    const { parseIngredientLine } = await import("../src/lib/ingredient-parse");
    expect(parseIngredientLine("1 unit(s) Bell Pepper")).toMatchObject({ amount: "1", name: "Bell Pepper" });
    expect(parseIngredientLine("100 milliliter(s) Water for the Sauce")).toMatchObject({ amount: "100", name: "Water for the Sauce" });
    expect(parseIngredientLine("1 sachet(s) Salt & Pepper Seasoning")).toMatchObject({ amount: "1", name: "Salt & Pepper Seasoning" });
    expect(parseIngredientLine("1 (s) Egg")).toMatchObject({ amount: "1", name: "Egg" });
  });
  test("units are shortened and stray (s) removed in stored recipes", () => {
    const out = normalizeMealKitIngredients([
      { name: "Potatoes", amount: "450", unit: "grams" },
      { name: "Water for the Sauce", amount: "100", unit: "milliliters" },
      { name: "(s) Bell Pepper", amount: "1", unit: "units" },
    ]);
    expect(out.map((i) => [i.amount, i.unit, i.name].filter(Boolean).join(" "))).toEqual(["450 g Potatoes", "100 ml Water for the Sauce", "1 Bell Pepper"]);
  });
});

describe("groups and singular units", () => {
  test("one heading per ingredient is dropped; real sections and pantry are kept", async () => {
    const { dropMeaninglessGroups } = await import("../src/lib/mealkit");
    const out = dropMeaninglessGroups([
      { name: "Potatoes", amount: "450", unit: "g", group: "Potatoes" },
      { name: "Sausage Meat", amount: "225", unit: "g", group: "Potatoes" },
      { name: "Garlic Clove", amount: "2", group: "Sausage Meat" },
      { name: "Passata", amount: "1", unit: "carton", group: "Garlic Clove" },
      { name: "Peas", amount: "120", unit: "g", group: "Passata" },
      { name: "Cheddar", amount: "30", unit: "g", group: "Not included in your delivery" },
      { name: "Sugar", amount: "1", unit: "tsp", group: "Not included in your delivery" },
    ]);
    expect(out.map((i) => i.group ?? null)).toEqual([null, "Potatoes", null, null, null, "Pantry", "Pantry"]);
  });
  test("real sections survive", async () => {
    const { dropMeaninglessGroups } = await import("../src/lib/mealkit");
    const ings = [
      { name: "Flour", group: "For the dough" }, { name: "Yeast", group: "For the dough" },
      { name: "Tomatoes", group: "For the sauce" }, { name: "Basil", group: "For the sauce" },
    ];
    expect(dropMeaninglessGroups(ings)).toEqual(ings);
  });
  test("1 cartons reads 1 carton", () => {
    expect(normalizeMealKitIngredients([{ name: "Tomato Passata", amount: "1", unit: "cartons" }])[0]!.unit).toBe("carton");
    expect(normalizeMealKitIngredients([{ name: "Tomato Passata", amount: "2", unit: "cartons" }])[0]!.unit).toBe("cartons");
  });
});

describe("pantry and spice prefixes", () => {
  test("white cumin seeds sachet becomes teaspoons", () => {
    expect(normalizeMealKitIngredients([{ name: "White Cumin Seeds", amount: "1", unit: "sachet" }])[0]).toMatchObject({ unit: "tsp", amount: "1" });
  });
  test("cupboard items go in Pantry when asked, or when the source says not shipped", () => {
    const out = normalizeMealKitIngredients(
      [{ name: "Water for the Sauce", amount: "150", unit: "ml" }, { name: "Egg", amount: "1" }, { name: "Honey", amount: "1", unit: "tbsp" }, { name: "Carrot", amount: "3" }],
      { markPantry: true }
    );
    expect(out.map((i) => i.group ?? null)).toEqual(["Pantry", "Pantry", "Pantry", null]);
    const shipped = normalizeMealKitIngredients([{ name: "Breadcrumbs", amount: "50", unit: "g" }], { notShipped: new Set(["breadcrumbs"]) });
    expect(shipped[0]!.group).toBe("Pantry");
  });
});
