import { describe, expect, test } from "bun:test";
import { findLeftovers } from "../src/lib/leftovers";

const book = [
  { id: "r1", title: "Spinach and Ricotta Gnocchi", ingredientNames: ["gnocchi", "baby spinach", "ricotta"] },
  { id: "r2", title: "Creamy Mushroom Pasta", ingredientNames: ["mushrooms", "crème fraîche", "tagliatelle"], wantToMake: true },
  { id: "r3", title: "Planned Curry", ingredientNames: ["spinach", "coconut milk"] },
  { id: "r4", title: "Cheese Toastie", ingredientNames: ["mature cheddar cheese", "bread"] },
];

describe("findLeftovers", () => {
  test("partly used packs are flagged with recipes that use the rest", () => {
    const out = findLeftovers(
      [
        { name: "spinach", amount: "40", unit: "g" },
        { name: "crème fraîche", amount: "150", unit: "g" },
        { name: "spring onion", amount: "2" },
        { name: "cheddar", amount: "30", unit: "g" },
      ],
      book,
      ["r3"]
    );
    const byLabel = Object.fromEntries(out.map((l) => [l.label, l]));
    expect(byLabel["Baby spinach"]).toMatchObject({ used: "40 g", left: "60 g", buy: "1 × 100 g bag" });
    expect(byLabel["Baby spinach"]!.suggestions.map((s) => s.id)).toEqual(["r1"]); // r3 is already planned
    expect(byLabel["Crème fraîche"]).toMatchObject({ left: "50 ml" });
    expect(byLabel["Crème fraîche"]!.suggestions[0]!.title).toBe("Creamy Mushroom Pasta");
    expect(byLabel["Spring onions"]).toMatchObject({ used: "2", left: "5", buy: "1 bunch of 7" });
    expect(byLabel["Cheddar"]).toMatchObject({ left: "170 g" });
  });
  test("amounts across recipes add up before comparing with the pack", () => {
    const out = findLeftovers([
      { name: "baby spinach", amount: "100", unit: "g" },
      { name: "spinach", amount: "100", unit: "g" },
    ]);
    expect(out).toEqual([]); // 200 g uses a 200 g bag exactly
  });
  test("small leftovers and unknown items are ignored", () => {
    expect(findLeftovers([{ name: "mushrooms", amount: "240", unit: "g" }])).toEqual([]);
    expect(findLeftovers([{ name: "potatoes", amount: "450", unit: "g" }])).toEqual([]);
    expect(findLeftovers([{ name: "parsley", amount: "1", unit: "bunch" }])).toEqual([]);
  });
  test("more than the biggest pack uses several packs", () => {
    const out = findLeftovers([{ name: "coconut milk", amount: "500", unit: "ml" }]);
    expect(out[0]).toMatchObject({ buy: "2 × 400 ml tin", left: "300 ml" });
  });
});
