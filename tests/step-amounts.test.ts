import { describe, expect, test } from "bun:test";
import { annotateStep, type StepIngredient } from "../src/lib/step-amounts";
import { scaleIngredient } from "../src/lib/utils";

/** Render segments as text with amounts in [brackets], for easy assertions. */
const render = (text: string, ings: StepIngredient[]) =>
  annotateStep(text, ings).map((s) => (s.kind === "amount" ? ` [${s.text}]` : s.text)).join("");

const ings: StepIngredient[] = [
  { name: "Potatoes", amount: "450", unit: "g" },
  { name: "British Pork and Oregano Sausage Meat", amount: "225", unit: "g" },
  { name: "Tomato Passata", amount: "1", unit: "carton" },
  { name: "Onion", amount: "1" },
  { name: "Spring Onion", amount: "2" },
  { name: "Water for the Sauce", amount: "100", unit: "ml" },
  { name: "Mature Cheddar Cheese", amount: "30", unit: "g" },
  { name: "fine salt", amount: "1", unit: "tsp", group: "Salt and pepper mix (instead of Salt & Pepper Seasoning)" },
  { name: "ground black pepper", amount: "3/4", unit: "tsp", group: "Salt and pepper mix (instead of Salt & Pepper Seasoning)" },
  { name: "garlic powder", amount: "1/2", unit: "tsp", group: "Salt and pepper mix (instead of Salt & Pepper Seasoning)" },
];

describe("annotateStep", () => {
  test("full names and distinctive parts get their amount at first mention", () => {
    expect(render("Cut the potatoes into chunks, then boil the potatoes.", ings))
      .toBe("Cut the potatoes [450 g] into chunks, then boil the potatoes.");
    expect(render("Shape the sausage meat into balls.", ings)).toBe("Shape the sausage meat [225 g] into balls.");
    expect(render("Stir in the passata and the cheddar.", ings)).toBe("Stir in the passata [1 carton] and the cheddar [30 g].");
  });
  test("onion and spring onion are told apart", () => {
    expect(render("Slice the spring onion and the onion.", ings))
      .toBe("Slice the spring onion [2] and the onion [1].");
  });
  test("'see pantry for amount' is replaced by the amount", () => {
    expect(render("Pour in the water for the sauce (see pantry for amount) and boil.", ings))
      .toBe("Pour in the water for the sauce [100 ml] and boil.");
  });
  test("a split spice sachet shows its total", () => {
    expect(render("Add half the salt & pepper seasoning to the chips.", ings))
      .toBe("Add half the salt & pepper seasoning [2 1/4 tsp mix] to the chips.");
  });
  test("vague words and existing amounts are left alone", () => {
    expect(render("Drizzle with oil and season with salt and pepper.", ings))
      .toBe("Drizzle with oil and season with salt and pepper.");
    expect(render("Boil with 450 g potatoes.", ings)).toBe("Boil with 450 g potatoes.");
  });
  test("follows Whisk's scaler", () => {
    const doubled = ings.map((i) => scaleIngredient(i as never, 2, 4) as StepIngredient);
    expect(render("Boil the potatoes.", doubled)).toBe("Boil the potatoes [900 g].");
  });
  test("no amounts, no change", () => {
    expect(render("Serve.", [])).toBe("Serve.");
  });
});
