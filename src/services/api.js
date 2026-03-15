// ── Edge Function client ───────────────────────────────────────────────────────
// All Claude and Gemini calls are proxied through the Supabase Edge Function
// at /functions/v1/digitize so API keys never appear in the browser network tab.

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/digitize`;
const EDGE_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

const callEdge = async (body) => {
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: EDGE_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Edge function error ${res.status}`);
  }
  return res.json();
};

// ── Public API ────────────────────────────────────────────────────────────────

export const extractRecipes = (fileData) =>
  callEdge({ action: "extract", images: fileData });

export const translateRecipe = (recipe, targetLang) =>
  callEdge({ action: "translate", recipe, targetLang });

export const generateContextualExtractionMessages = (fileData) =>
  callEdge({ action: "loadingMessages", images: fileData });

export const generateContextualTranslationMessages = (recipes) =>
  callEdge({ action: "translationLoading", recipes });

export const generateRecipeImage = (recipe) =>
  callEdge({ action: "generateImage", recipe });

export const generateRawGeminiImage = (prompt) =>
  callEdge({ action: "rawImage", prompt });

// ── Pure helpers (no API call) ────────────────────────────────────────────────

export const generateIngredientImagePrompt = (name, amount, unit) => {
  const safeAmount = (amount ?? "").toString().trim();
  const safeUnit = (unit ?? "").toString().trim().toLowerCase();

  const countableUnits = new Set([
    "", "whole", "piece", "pieces", "pcs", "pc",
    "slice", "slices", "clove", "cloves",
    "sprig", "sprigs", "leaf", "leaves",
    "stalk", "stalks", "head", "heads",
    "bunch", "bunches", "strip", "strips",
  ]);
  const insignificantUnits = new Set(["whole", "piece", "pieces", "pcs", "pc"]);

  const isCountable = countableUnits.has(safeUnit);
  const numAmount = parseFloat(safeAmount);
  const isWholeNum = !isNaN(numAmount) && Number.isInteger(numAmount) && numAmount >= 1 && numAmount <= 12;

  let subject;
  if (isCountable && isWholeNum) {
    const unitPart = safeUnit && !insignificantUnits.has(safeUnit) ? ` ${safeUnit} of` : "";
    subject = `exactly ${numAmount}${unitPart} ${name}`;
  } else if (safeAmount && safeUnit) {
    subject = `${safeAmount} ${safeUnit} of ${name}`;
  } else if (safeAmount) {
    subject = `${safeAmount} ${name}`;
  } else {
    subject = name;
  }

  return `Minimalist, clean, top-down food photography of ${subject} on a pure white background. No text, no labels, soft natural lighting, cookbook style.`;
};
