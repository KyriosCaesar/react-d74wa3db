// ── Anthropic API ─────────────────────────────────────────────────────────────
// TODO: Move these calls to a Supabase Edge Function (`supabase/functions/digitize`)
// to keep API keys off the client. The frontend would then POST the image(s) to
// `/functions/v1/digitize` and receive the same JSON response.

const ANTHROPIC_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};

const callClaude = async (messages, maxTokens = 2000, model = "claude-opus-4-5") => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const data = await response.json();
  const text = data.content?.find((b) => b.type === "text")?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

// ── Extraction prompt ─────────────────────────────────────────────────────────

const buildExtractionPrompt = () => `You are an expert culinary editor and recipe designer. I am sending you one or more images of cookbook pages or recipe cards.

FIRST, determine how many distinct, complete recipes exist across ALL images combined:
- If multiple images show different parts or angles of the SAME recipe, count it as ONE recipe.
- If a single image contains multiple separate recipes, count each as its own recipe.
- If each image shows a completely different recipe, count each separately.

THEN, for each distinct recipe, extract and structure it using the rules below.

Return a JSON ARRAY of recipe objects — even if there is only one recipe, wrap it in an array: [{...}]
Return ONLY valid JSON — no markdown fences, no explanation.

Apply every rule below strictly for each recipe:

1. METADATA
- "title": exact recipe name.
- "source": name of the cookbook, website, or author if visible (as plain text, not a hashtag). null if not visible.
- "tags": 2–4 relevant category tags as an array (e.g. ["Seafood", "Starter", "Italian"]). Include the source name as the first tag if visible.
- "difficulty": Easy = simple techniques, under 45 min active time. Medium = moderate skill or multi-step. Hard = advanced technique, long process, or precision required.
- "prepTime" / "cookTime": integers in minutes.
- "servings": base yield as an integer.
- "category": one of Main | Dessert | Starter | Soup | Bread | Salad | Snack | Drink | Other.
- "cuisine": country or regional cuisine (e.g. "Italian", "French", "Middle Eastern").
- "description": 1–2 sentences summarising the dish appealingly.

2. NUTRITION (per serving)
Estimate if not provided: "calories" (kcal), "protein" (g), "fat" (g), "carbs" (g). Use standard nutritional databases.

3. EQUIPMENT
First, extract any explicitly listed equipment from the source. If no list exists, infer from the method. Include only tools and appliances (e.g. "fine-mesh sieve", "stand mixer", "23×33 cm baking dish"). Exclude serving dishes and cutlery.

4. INGREDIENTS — Mise en Place
Integrate the preparation state directly into each ingredient line so the cook knows exactly what to do before turning on the stove. Use the "note" field for all prep states (e.g. "finely diced", "room temperature", "toasted and ground", "cut into 2 cm cubes"). Never write a vague entry like "1 onion" when you can write "1 medium onion, finely diced".

5. STEPS — Rewrite the method with these rules:
a) Numbered, single-action focus: maximum 1–2 actions per step. Break dense paragraphs down.
b) Integrate floating data: if the source uses callout boxes or floating UI elements for times or temperatures alongside the text, weave those values directly into the sentence.
c) Bold key variables: wrap exact times, temperatures, and visual/textural doneness cues in double asterisks so they render as bold (e.g. "Bake for **35 minutes** at **180°C** until **golden brown**").
d) Also extract the primary time into "duration" (integer minutes) and temperature into "temp" (integer Celsius) as separate fields for UI display. null if not applicable.
e) Do NOT include background information, tips, or warnings inside steps — move those to "notes".

6. NOTES
Collect all chef's tips, variations, resting times, storage advice, and warnings here. Keep the active steps clean.

Each recipe object must follow this exact structure:
{
  "title": "Recipe name",
  "description": "1–2 sentence description",
  "difficulty": "Easy | Medium | Hard",
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "category": "Main | Dessert | Starter | Soup | Bread | Salad | Snack | Drink | Other",
  "cuisine": "Italian",
  "tags": ["SourceName", "Seafood", "Starter"],
  "source": "Book title or author if visible, else null",
  "equipment": ["large skillet", "fine-mesh sieve"],
  "nutrition": { "calories": 350, "protein": 25, "fat": 12, "carbs": 30 },
  "ingredients": [
    { "amount": "200", "unit": "g", "name": "ingredient", "note": "finely diced" }
  ],
  "steps": [
    { "step": 1, "instruction": "Heat **2 tbsp** of olive oil in a large skillet over **medium-high heat**.", "duration": null, "temp": null }
  ],
  "thermomixAdapted": false,
  "notes": "Resting time, tips, variations, storage advice."
}

Use null for any unknown field. "thermomixAdapted": true only if you rewrite steps for Thermomix.`;

const buildTranslationPrompt = (recipe, targetLang) => {
  const langName = targetLang === "de" ? "German" : "French";
  return `Translate the following recipe fields to ${langName}. Return ONLY a JSON object — no markdown, no explanation, just raw JSON.

Translate: title, description, ingredient names and notes, step instructions, notes, tags, category, cuisine, and equipment items.
Do NOT translate: amounts, units, numbers, temperatures, or proper nouns like brand names.

Input JSON:
${JSON.stringify({
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients?.map((i) => ({ name: i.name, note: i.note ?? null })),
    steps: recipe.steps?.map((s) => ({ instruction: s.instruction })),
    notes: recipe.notes ?? null,
    tags: recipe.tags ?? [],
    category: recipe.category ?? null,
    cuisine: recipe.cuisine ?? null,
    equipment: recipe.equipment ?? [],
  }, null, 2)}`;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const extractRecipes = (fileData) => {
  const content = [
    ...fileData.map(f => ({
      type: "image",
      source: { type: "base64", media_type: f.mediaType, data: f.base64 },
    })),
    { type: "text", text: buildExtractionPrompt() },
  ];
  return callClaude([{ role: "user", content }], Math.max(4000, fileData.length * 3000));
};

export const translateRecipe = (recipe, targetLang) =>
  callClaude(
    [{ role: "user", content: buildTranslationPrompt(recipe, targetLang) }],
    1500,
    "claude-haiku-4-5"
  );

export const generateContextualExtractionMessages = (fileData) => {
  const content = [
    ...fileData.map(f => ({
      type: "image",
      source: { type: "base64", media_type: f.mediaType, data: f.base64 },
    })),
    {
      type: "text",
      text: `Glance at these cookbook or recipe images and write 6 short, witty one-liner messages that will display while an AI extracts the recipe.

Be specific — reference the dish, key ingredients, cooking technique, or cuisine. Use wordplay, culinary puns, and gentle humour. Keep each message under 75 characters.

Return ONLY a JSON array of 6 strings. No markdown, no explanation.`,
    },
  ];
  return callClaude([{ role: "user", content }], 400, "claude-haiku-4-5");
};

export const generateContextualTranslationMessages = (recipes) => {
  const titles = recipes.map(r => r.title).join(" and ");
  return callClaude(
    [{
      role: "user",
      content: `Write 6 short, witty one-liner loading messages for this process: translating "${titles}" into German and French, and generating an AI food photograph.

Mix language or translation jokes with food puns. Keep each message under 75 characters.

Return ONLY a JSON array of 6 strings. No markdown, no explanation.`,
    }],
    300,
    "claude-haiku-4-5"
  );
};

// ── Gemini image generation ───────────────────────────────────────────────────

const callGemini = async (parts) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );
  const data = await res.json();
  const b64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  return b64 ? `data:image/png;base64,${b64}` : null;
};

const PROP_OPTIONS = [
  "a vintage silver fork resting diagonally",
  "a small ceramic bowl of sea salt",
  "a sprig of fresh rosemary",
  "a linen napkin folded loosely",
  "a rustic wooden spoon",
  "a small glass of olive oil",
  "a cluster of cherry tomatoes on the vine",
  "a wedge of lemon",
];

const DIRECTIONS = ["top-right", "top-left", "bottom-right", "bottom-left"];

export const generateRecipeImage = async (recipe) => {
  const randomDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  const randomProp = PROP_OPTIONS[Math.floor(Math.random() * PROP_OPTIONS.length)];
  const basePrompt = `A professional, top-down, centered, flat-lay food photograph of a perfectly round plate with ${recipe.title} arranged as described in the recipe: ${recipe.description || recipe.title}. The plate is centered against a seamless and full-frame background of a tablecloth or surface that matches the cultural style of this dish (${recipe.cuisine || "international"} cuisine). To the ${randomDirection} of the plate, place ${randomProp}. The entire frame is a square and looks like a clean, single image taken for a recipe book.`;

  const parts = [];
  if (recipe.imageUrl && recipe.imageUrl.startsWith("data:")) {
    const commaIdx = recipe.imageUrl.indexOf(",");
    const b64data = recipe.imageUrl.slice(commaIdx + 1);
    const mimeType = recipe.imageUrl.slice(0, commaIdx).match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
    parts.push({ inlineData: { mimeType, data: b64data } });
    parts.push({
      text: `The image above is the original cookbook photo for this recipe. Use it as a visual reference — match the dish's appearance, colour palette, plating style, and food presentation as closely as possible in the generated image. Now generate: ${basePrompt}`,
    });
  } else {
    parts.push({ text: basePrompt });
  }

  return callGemini(parts);
};

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

export const generateRawGeminiImage = (prompt) =>
  callGemini([{ text: prompt }]);
