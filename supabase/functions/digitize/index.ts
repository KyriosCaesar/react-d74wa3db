/**
 * Supabase Edge Function: /functions/v1/digitize
 *
 * Handles all AI calls server-side so API keys never reach the browser.
 *
 * POST body (JSON):
 *   {
 *     images: [{ base64: string, mediaType: string }],  // one or more cookbook photos
 *     action: "extract" | "translate" | "generateImage" | "loadingMessages"
 *     // For translate:
 *     recipe?: object,
 *     targetLang?: "de" | "fr"
 *     // For generateImage:
 *     recipe?: object
 *   }
 *
 * Deploy with:
 *   supabase functions deploy digitize --no-verify-jwt
 *
 * Then update src/services/api.js to call:
 *   POST /functions/v1/digitize
 * instead of hitting Anthropic / Google directly.
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
    const { action, images, recipe, targetLang } = await req.json();

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
      const prompt = buildTranslationPrompt(recipe, langName);
      result = await callClaude([{ role: "user", content: prompt }], 1500, "claude-haiku-4-5");

    } else if (action === "generateImage") {
      result = await generateRecipeImage(recipe);

    } else if (action === "loadingMessages") {
      const content = [
        ...images.map((f: { base64: string; mediaType: string }) => ({
          type: "image",
          source: { type: "base64", media_type: f.mediaType, data: f.base64 },
        })),
        { type: "text", text: `Write 6 short, witty one-liner loading messages for AI recipe extraction. Be specific to the dish/ingredients visible. Under 75 chars each. Return ONLY a JSON array of 6 strings.` },
      ];
      result = await callClaude([{ role: "user", content }], 400, "claude-haiku-4-5");

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

// ── Prompts (duplicated from frontend — single source of truth once deployed) ─

function buildTranslationPrompt(recipe: Record<string, unknown>, langName: string) {
  return `Translate the following recipe fields to ${langName}. Return ONLY a JSON object — no markdown, no explanation.
Translate: title, description, ingredient names and notes, step instructions, notes, tags, category, cuisine, equipment.
Do NOT translate: amounts, units, numbers, temperatures, or proper nouns.
Input JSON:\n${JSON.stringify({
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
  const directions = ["top-right", "top-left", "bottom-right", "bottom-left"];
  const props = ["a vintage silver fork", "a small ceramic bowl of sea salt", "a sprig of fresh rosemary", "a rustic wooden spoon"];
  const dir = directions[Math.floor(Math.random() * directions.length)];
  const prop = props[Math.floor(Math.random() * props.length)];
  const prompt = `A professional, top-down flat-lay food photograph of ${recipe.title}. ${recipe.description}. ${recipe.cuisine} cuisine style tablecloth. ${prop} to the ${dir}. Square frame, recipe book style.`;
  return callGemini([{ text: prompt }]);
}

// Inline extraction prompt (same as frontend — move to a shared config once Edge Function is deployed)
const EXTRACTION_PROMPT = `You are an expert culinary editor. Extract all distinct recipes from the images.
Return a JSON ARRAY of recipe objects. Even for one recipe, wrap in an array: [{...}]
Return ONLY valid JSON.

Each recipe object:
{
  "title": string, "description": string, "difficulty": "Easy|Medium|Hard",
  "servings": number, "prepTime": number, "cookTime": number,
  "category": "Main|Dessert|Starter|Soup|Bread|Salad|Snack|Drink|Other",
  "cuisine": string, "tags": string[], "source": string|null,
  "equipment": string[],
  "nutrition": { "calories": number, "protein": number, "fat": number, "carbs": number },
  "ingredients": [{ "amount": string, "unit": string, "name": string, "note": string|null }],
  "steps": [{ "step": number, "instruction": string, "duration": number|null, "temp": number|null }],
  "thermomixAdapted": false, "notes": string|null
}`;
