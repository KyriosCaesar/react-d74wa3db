/**
 * Supabase Edge Function: /functions/v1/digitize
 *
 * Handles all AI calls server-side so API keys never reach the browser.
 *
 * POST body (JSON):
 *   { action: "extract",             images: [{ base64, mediaType }] }
 *   { action: "translate",           recipe, targetLang: "de"|"fr" }
 *   { action: "generateImage",       recipe }
 *   { action: "loadingMessages",     images: [{ base64, mediaType }] }
 *   { action: "translationLoading",  recipes: [{ title }] }
 *   { action: "rawImage",            prompt: string }
 *
 * Deploy:
 *   supabase functions deploy digitize --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_KEY    = Deno.env.get("GEMINI_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Claude helper ─────────────────────────────────────────────────────────────
async function callClaude(messages: unknown[], maxTokens = 2000, model = "claude-opus-4-5") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  const text = (data.content as Array<{ type: string; text: string }>)
    ?.find(b => b.type === "text")?.text ?? "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ── Gemini helper ─────────────────────────────────────────────────────────────
async function callGemini(parts: unknown[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_KEY}`,
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
  const b64 = (data.candidates?.[0]?.content?.parts as Array<{ inlineData?: { data: string } }>)
    ?.find(p => p.inlineData)?.inlineData?.data;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

// ── Request handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { action, images, recipe, recipes, targetLang, prompt } = await req.json();

    let result: unknown;

    if (action === "extract") {
      const content = [
        ...images.map((f: { base64: string; mediaType: string }) => ({
          type: "image",
          source: { type: "base64", media_type: f.mediaType, data: f.base64 },
        })),
        { type: "text", text: EXTRACTION_PROMPT },
      ];
      result = await callClaude([{ role: "user", content }], Math.max(4000, images.length * 3000));

    } else if (action === "translate") {
      const langName = targetLang === "de" ? "German" : "French";
      result = await callClaude(
        [{ role: "user", content: buildTranslationPrompt(recipe, langName) }],
        1500,
        "claude-haiku-4-5"
      );

    } else if (action === "generateImage") {
      result = await generateRecipeImage(recipe);

    } else if (action === "loadingMessages") {
      const content = [
        ...images.map((f: { base64: string; mediaType: string }) => ({
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
      result = await callClaude([{ role: "user", content }], 400, "claude-haiku-4-5");

    } else if (action === "translationLoading") {
      const titles = (recipes as Array<{ title: string }>).map(r => r.title).join(" and ");
      result = await callClaude(
        [{
          role: "user",
          content: `Write 6 short, witty one-liner loading messages for this process: translating "${titles}" into German and French, and generating an AI food photograph.

Mix language or translation jokes with food puns. Keep each message under 75 characters.

Return ONLY a JSON array of 6 strings. No markdown, no explanation.`,
        }],
        300,
        "claude-haiku-4-5"
      );

    } else if (action === "rawImage") {
      result = await callGemini([{ text: prompt }]);

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildTranslationPrompt(recipe: Record<string, unknown>, langName: string) {
  return `Translate the following recipe fields to ${langName}. Return ONLY a JSON object — no markdown, no explanation, just raw JSON.

Translate: title, description, ingredient names and notes, step instructions, notes, tags, category, cuisine, and equipment items.
Do NOT translate: amounts, units, numbers, temperatures, or proper nouns like brand names.

Input JSON:
${JSON.stringify({
    title: recipe.title,
    description: recipe.description,
    ingredients: (recipe.ingredients as Array<{ name: string; note?: string }>)?.map(i => ({ name: i.name, note: i.note ?? null })),
    steps: (recipe.steps as Array<{ instruction: string }>)?.map(s => ({ instruction: s.instruction })),
    notes: recipe.notes ?? null,
    tags: recipe.tags ?? [],
    category: recipe.category ?? null,
    cuisine: recipe.cuisine ?? null,
    equipment: recipe.equipment ?? [],
  }, null, 2)}`;
}

async function generateRecipeImage(recipe: Record<string, unknown>) {
  const props = [
    "a vintage silver fork resting diagonally",
    "a small ceramic bowl of sea salt",
    "a sprig of fresh rosemary",
    "a linen napkin folded loosely",
    "a rustic wooden spoon",
    "a small glass of olive oil",
    "a cluster of cherry tomatoes on the vine",
    "a wedge of lemon",
  ];
  const directions = ["top-right", "top-left", "bottom-right", "bottom-left"];
  const dir = directions[Math.floor(Math.random() * directions.length)];
  const prop = props[Math.floor(Math.random() * props.length)];

  const basePrompt = `A professional, top-down, centered, flat-lay food photograph of a perfectly round plate with ${recipe.title} arranged as described in the recipe: ${recipe.description || recipe.title}. The plate is centered against a seamless and full-frame background of a tablecloth or surface that matches the cultural style of this dish (${recipe.cuisine || "international"} cuisine). To the ${dir} of the plate, place ${prop}. The entire frame is a square and looks like a clean, single image taken for a recipe book.`;

  const parts: unknown[] = [];
  const imageUrl = recipe.imageUrl as string | undefined;
  if (imageUrl?.startsWith("data:")) {
    const commaIdx = imageUrl.indexOf(",");
    const b64data = imageUrl.slice(commaIdx + 1);
    const mimeType = imageUrl.slice(0, commaIdx).match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
    parts.push({ inlineData: { mimeType, data: b64data } });
    parts.push({
      text: `The image above is the original cookbook photo for this recipe. Use it as a visual reference — match the dish's appearance, colour palette, plating style, and food presentation as closely as possible in the generated image. Now generate: ${basePrompt}`,
    });
  } else {
    parts.push({ text: basePrompt });
  }

  return callGemini(parts);
}

const EXTRACTION_PROMPT = `You are an expert culinary editor and recipe designer. I am sending you one or more images of cookbook pages or recipe cards.

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
