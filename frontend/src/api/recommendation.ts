import type { Candle } from "../types/candle";

export type QuizAnswers = {
  name: string;
  mood: Mood;
  space: Space;
  intensity: Intensity;
  notes: Note[];
  season: Season;
  occasion: Occasion;
};

export type Mood = "Cozy evening" | "Fresh morning" | "Romantic" | "Focus" | "Party";
export type Space = "Living room" | "Bedroom" | "Bathroom" | "Kitchen" | "Office";
export type Intensity = "Soft" | "Medium" | "Strong";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type Occasion = "Everyday" | "Gift" | "Self-care" | "Dinner" | "Weekend";
export type Note = "Vanilla" | "Citrus" | "Woody" | "Spicy" | "Floral" | "Fresh" | "Gourmand";

export type ScentVector = Record<string, number>;

export type Recommendation = {
  candle: Candle;
  score: number; // 0..1
  reason: string[];
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function dot(a: ScentVector, b: ScentVector): number {
  let s = 0;
  for (const k of Object.keys(a)) s += (a[k] ?? 0) * (b[k] ?? 0);
  return s;
}

function norm(a: ScentVector): number {
  return Math.sqrt(dot(a, a));
}

function cosineSimilarity(a: ScentVector, b: ScentVector): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot(a, b) / (na * nb));
}

/**
 * Build user vector from answers.
 * This is the "AI" part: we build a profile vector and match with cosine similarity.
 */
export function buildUserVector(ans: QuizAnswers): { vector: ScentVector; reason: string[] } {
  const v: ScentVector = {};
  const r: string[] = [];

  const add = (key: string, w: number, why: string) => {
    v[key] = (v[key] ?? 0) + w;
    r.push(why);
  };

  // mood
  if (ans.mood === "Cozy evening") {
    add("warm", 1.2, "Cozy mood → warmer notes");
    add("woody", 0.8, "Cozy mood → soft woods");
    add("gourmand", 0.7, "Cozy mood → comfort sweetness");
  }
  if (ans.mood === "Fresh morning") {
    add("fresh", 1.2, "Fresh mood → airy notes");
    add("citrus", 0.9, "Fresh mood → citrus lift");
  }
  if (ans.mood === "Romantic") {
    add("floral", 1.0, "Romantic mood → florals");
    add("warm", 0.6, "Romantic mood → amber warmth");
  }
  if (ans.mood === "Focus") {
    add("woody", 1.0, "Focus mood → grounded woods");
    add("fresh", 0.5, "Focus mood → clean clarity");
  }
  if (ans.mood === "Party") {
    add("spicy", 0.9, "Party mood → spicy energy");
    add("citrus", 0.6, "Party mood → bright top notes");
  }

  // space
  if (ans.space === "Bedroom") add("soft", 0.7, "Bedroom → softer profile");
  if (ans.space === "Bathroom") add("fresh", 0.7, "Bathroom → fresh profile");
  if (ans.space === "Kitchen") add("citrus", 0.5, "Kitchen → clean/citrus bias");
  if (ans.space === "Office") add("woody", 0.6, "Office → focused/woody bias");

  // intensity
  if (ans.intensity === "Soft") add("soft", 1.0, "Soft throw preference");
  if (ans.intensity === "Medium") add("balanced", 1.0, "Balanced throw preference");
  if (ans.intensity === "Strong") add("strong", 1.0, "Strong throw preference");

  // notes
  for (const n of ans.notes) {
    if (n === "Vanilla") add("gourmand", 1.0, "Vanilla note");
    if (n === "Citrus") add("citrus", 1.0, "Citrus note");
    if (n === "Woody") add("woody", 1.0, "Woody note");
    if (n === "Spicy") add("spicy", 1.0, "Spicy note");
    if (n === "Floral") add("floral", 1.0, "Floral note");
    if (n === "Fresh") add("fresh", 1.0, "Fresh note");
    if (n === "Gourmand") add("gourmand", 1.0, "Gourmand note");
  }

  // season
  if (ans.season === "Autumn" || ans.season === "Winter") {
    add("warm", 0.8, "Cold season → warm bias");
    add("spicy", 0.4, "Cold season → spice bias");
  } else {
    add("fresh", 0.6, "Warm season → fresh bias");
    add("citrus", 0.4, "Warm season → citrus bias");
  }

  // occasion
  if (ans.occasion === "Gift") add("premium", 0.5, "Gift → premium vibe");
  if (ans.occasion === "Self-care") add("soft", 0.5, "Self-care → softer vibe");
  if (ans.occasion === "Dinner") add("warm", 0.4, "Dinner → warm atmosphere");
  if (ans.occasion === "Weekend") add("playful", 0.3, "Weekend → playful");

  return { vector: v, reason: r };
}

/**
 * Candle vector is derived from existing fields (no backend changes):
 * - collections slug/name
 * - category name
 * - candle name (keyword hints)
 */
export function buildCandleVector(c: Candle): ScentVector {
  const v: ScentVector = {};
  const add = (k: string, w: number) => (v[k] = (v[k] ?? 0) + w);

  const hay = `${c.name} ${c.description ?? ""} ${c.collections?.map(x => x.name + " " + x.slug).join(" ") ?? ""}`.toLowerCase();

  // keyword heuristics (works NOW with your current model)
  if (/(vanilla|cream|caramel|cookie|cocoa|chocolate|sweet)/.test(hay)) add("gourmand", 1.2);
  if (/(citrus|lemon|orange|bergamot|grapefruit)/.test(hay)) add("citrus", 1.2);
  if (/(wood|woody|cedar|sandal|pine|fir|oak)/.test(hay)) add("woody", 1.2);
  if (/(spice|spicy|cinnamon|clove|pepper|cardamom)/.test(hay)) add("spicy", 1.1);
  if (/(rose|floral|jasmine|lily|peony)/.test(hay)) add("floral", 1.1);
  if (/(fresh|cotton|clean|sea|ocean|breeze|mint)/.test(hay)) add("fresh", 1.0);

  // seasonal collection hints
  if (/(autumn|fall|winter|holiday|christmas|halloween)/.test(hay)) {
    add("warm", 0.7);
    add("spicy", 0.3);
  }
  if (/(spring|summer)/.test(hay)) {
    add("fresh", 0.5);
    add("citrus", 0.2);
  }

  // bestseller/soldout hints can influence ranking slightly
  if (c.is_bestseller) add("premium", 0.15);

  return v;
}

export function recommendCandles(
  answers: QuizAnswers,
  candles: Candle[],
  limit = 3
): { profile: { vector: ScentVector; reason: string[] }; top: Recommendation[] } {
  const profile = buildUserVector(answers);

  const scored: Recommendation[] = candles.map((c) => {
    const cv = buildCandleVector(c);
    const sim = cosineSimilarity(profile.vector, cv);

    const reason: string[] = [];
    if (sim > 0.72) reason.push("Very strong match to your profile");
    else if (sim > 0.55) reason.push("Strong match to your profile");
    else reason.push("Decent match");

    if (answers.mood === "Cozy evening") reason.push("Warm/cozy direction");
    if (answers.mood === "Fresh morning") reason.push("Fresh/bright direction");

    return { candle: c, score: sim, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  return { profile, top: scored.slice(0, limit) };
}