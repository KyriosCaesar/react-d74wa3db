import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SAMPLE_RECIPES = [];

// Messages cycled during the extraction phase (Claude reading images)
const EXTRACTION_MESSAGES = [
  "Teaching Claude to read handwriting… one smudge at a time.",
  "Figuring out if that says 'clove' or 'glove'…",
  "Cross-referencing with 847 cookbooks in the AI's memory…",
  "Translating chef-speak into a step-by-step guide…",
  "Converting 'a generous handful' into an actual measurement…",
  "Separating the mise en place from the mise en page…",
  "Spotting the secret ingredient hiding in the margin…",
  "Calculating exactly how many pinches make a teaspoon…",
  "Reading between the lines — and the ingredient lines…",
  "Deciding whether 'season to taste' counts as a real instruction…",
];

// Messages cycled during the translation + image generation phase
const TRANSLATION_MESSAGES = [
  "Summoning the German equivalent of 'al dente'…",
  "Asking the French how they really feel about butter…",
  "Painting pixels of pure deliciousness for your library…",
  "Teaching an AI what 'golden brown' looks like…",
  "Your recipe is getting its professional portrait taken…",
  "Finding the perfect lighting for the plating shot…",
  "Translating 'season to taste' into three languages…",
  "Whisking together colours and textures for the thumbnail…",
  "Generating a photo even Gordon Ramsay would approve of…",
  "Almost there — just adding the finishing touches…",
];

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const API_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};

// Returns a JSON ARRAY of recipe objects (even for a single recipe).
// Includes instructions for Claude to determine how many distinct recipes
// exist across all supplied images.
const extractRecipesPrompt = () => `You are an expert culinary editor and recipe designer. I am sending you one or more images of cookbook pages or recipe cards.

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

const translateRecipePrompt = (recipe, targetLang) => {
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

const callAPI = async (messages, maxTokens = 2000, model = "claude-opus-4-5") => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const data = await response.json();
  const text = data.content?.find((b) => b.type === "text")?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

const translateRecipe = (recipe, targetLang) =>
  callAPI([{ role: "user", content: translateRecipePrompt(recipe, targetLang) }], 1500, "claude-haiku-4-5");

// Glances at the uploaded images and generates 6 witty, recipe-specific
// loading messages. Runs in parallel with the main opus extraction call —
// haiku typically finishes in 2–5 s, well before opus is done.
const generateContextualExtractionMessages = async (fileData) => {
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
  return callAPI([{ role: "user", content }], 400, "claude-haiku-4-5");
};

// Once we know the recipe title(s), generates 6 quips about translating
// and AI food photography. Runs in parallel with the real translation calls.
const generateContextualTranslationMessages = async (recipes) => {
  const titles = recipes.map(r => r.title).join(" and ");
  return callAPI(
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

const renderBold = (text) => {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ color: "#3a2810" }}>{part}</strong> : part
  );
};

// Returns ingredients + equipment mentioned in a single step instruction
const getMentionedItems = (step, recipe) => {
  const text = (step.instruction || "").toLowerCase();
  const result = [];
  const seen = new Set();
  for (const ing of (recipe.ingredients || [])) {
    const n = ing.name.toLowerCase().trim();
    const variants = [n, n + "s", n + "es", n.endsWith("s") ? n.slice(0, -1) : n + "x"];
    if (n.length > 2 && variants.some(v => text.includes(v)) && !seen.has(n)) {
      seen.add(n);
      result.push({ type: "ingredient", name: ing.name, amount: ing.amount, unit: ing.unit });
    }
  }
  for (const eq of (recipe.equipment || [])) {
    const n = eq.toLowerCase().trim();
    const variants = [n, n + "s", n.endsWith("s") ? n.slice(0, -1) : n + "x"];
    if (n.length > 2 && variants.some(v => text.includes(v)) && !seen.has(n)) {
      seen.add(n);
      result.push({ type: "equipment", name: eq });
    }
  }
  return result;
};

// ── Empty State Hero ─────────────────────────────────────────────────────────
// All 8 cookbook cover SVGs served from /public/books/
const BOOK_IMAGES = [
  "/books/book-0.svg",
  "/books/book-1.svg",
  "/books/book-2.svg",
  "/books/book-3.svg",
  "/books/book-4.svg",
  "/books/book-5.svg",
  "/books/book-6.svg",
  "/books/book-7.svg",
];

function BookCover({ src }) {
  return (
    <img
      src={src}
      alt="Cookbook"
      style={{
        height: 300,
        width: "auto",
        display: "block",
        filter: "drop-shadow(0px 40px 80px rgba(0,0,0,0.18)) drop-shadow(0px 12px 32px rgba(0,0,0,0.09))",
      }}
    />
  );
}

function EmptyStateHero({ onFiles }) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scattered, setScattered] = useState(false);
  const [isMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 640);

  const { scrollYProgress: sp } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  // Pick 3 random books on mount
  const selectedImages = useMemo(() => {
    const shuffled = [...BOOK_IMAGES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);

  // Desktop scroll-linked transforms — 3 books × 3 props (x, y, rotate)
  // ∩ shape: center rises, sides drop
  const b0x = useTransform(sp, [0, 1], [  0, -290]); const b0y = useTransform(sp, [0, 1], [0,  90]); const b0r = useTransform(sp, [0, 1], [ -3, -20]);
  const b1x = useTransform(sp, [0, 1], [  0,    0]); const b1y = useTransform(sp, [0, 1], [0, -70]); const b1r = useTransform(sp, [0, 1], [ -1,  -2]);
  const b2x = useTransform(sp, [0, 1], [  0,  290]); const b2y = useTransform(sp, [0, 1], [0,  90]); const b2r = useTransform(sp, [0, 1], [  2,  20]);

  // Headline fades and lifts as user scrolls
  const hlOp = useTransform(sp, [0, 0.5], [1, 0.65]);
  const hlY  = useTransform(sp, [0, 0.5], [0, -18]);
  // Scroll indicator fades out as soon as user starts scrolling
  const scOp = useTransform(sp, [0, 0.2], [1, 0]);

  useEffect(() => {
    if (!isMobile) return;
    const t = setTimeout(() => setScattered(true), 900);
    return () => clearTimeout(t);
  }, [isMobile]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  const TR = { duration: 0.9, ease: [0.22, 0.68, 0, 1.2] };

  // Per-book config: desktop MotionValues, mobile scatter target, initial rotation, stacking z, float timing
  const bookDefs = [
    { ds: { x: b0x, y: b0y, rotate: b0r }, mob: { x: -120, y:  70, r: -18 }, ir: -3,   z: 2, floatDur: 3.8, floatDelay: 0 },
    { ds: { x: b1x, y: b1y, rotate: b1r }, mob: { x:    0, y: -70, r:  -1 }, ir: -0.5, z: 8, floatDur: 4.4, floatDelay: 0.7 },
    { ds: { x: b2x, y: b2y, rotate: b2r }, mob: { x:  120, y:  70, r:  18 }, ir:  2,   z: 2, floatDur: 3.2, floatDelay: 1.4 },
  ];

  return (
    <>
      {/* ── Scroll container (130vh desktop / 100svh mobile) with sticky hero ── */}
      <div
        ref={containerRef}
        style={{
          height: isMobile ? "100svh" : "130vh",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginTop: isMobile ? "-16px" : "-32px",
          position: "relative",
        }}
      >
        <div style={{
          position: isMobile ? "relative" : "sticky",
          top: 0,
          height: isMobile ? "100svh" : "100vh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isMobile ? "center" : "flex-start",
          paddingTop: isMobile ? 0 : "10vh",
          overflow: "hidden",
        }}>

          {/* ── Headline ── */}
          <motion.div
            style={isMobile
              ? { textAlign: "center", padding: "0 24px", marginBottom: 48, position: "relative", zIndex: 2 }
              : { opacity: hlOp, y: hlY, textAlign: "center", padding: "0 24px", marginBottom: 64, position: "relative", zIndex: 2 }}
            {...(isMobile ? {
              animate: { opacity: scattered ? 0.7 : 1, y: scattered ? -16 : 0 },
              transition: TR,
            } : {})}
          >
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 500, letterSpacing: "-0.025em", color: "#2c2416", lineHeight: 1.15, maxWidth: 540, margin: "0 auto" }}>
              What will you cook<br />from your shelf today?
            </h2>
            {isMobile && !scattered && (
              <p style={{ color: "#b8a888", fontSize: 14, marginTop: 14, fontStyle: "italic" }}>Opening your cookbooks…</p>
            )}
          </motion.div>

          {/* ── Books scene — stacked at center, then fly apart on scroll ── */}
          <div style={{ position: "relative", width: "100%", height: 400, zIndex: 2 }}>
            {/* Ground shadow beneath all books */}
            <div style={{
              position: "absolute", bottom: 0, left: "50%",
              transform: "translateX(-50%)",
              width: 420, height: 44,
              background: "radial-gradient(ellipse at center, rgba(44,36,22,0.18) 0%, transparent 72%)",
              pointerEvents: "none", zIndex: 0,
            }} />
            {bookDefs.map((bd, i) => (
              <motion.div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  zIndex: bd.z,
                  ...(isMobile ? {} : bd.ds),
                }}
                {...(isMobile ? {
                  initial: { x: 0, y: 0, rotate: bd.ir },
                  animate: scattered
                    ? { x: bd.mob.x, y: bd.mob.y, rotate: bd.mob.r }
                    : { x: 0, y: 0, rotate: bd.ir },
                  transition: { ...TR, delay: i * 0.05 },
                } : {})}
              >
                <div style={{ transform: "translate(-50%, -50%)" }}>
                  {/* Float animation wrapper — independent of Framer transforms */}
                  <div style={{ animation: `bookFloat ${bd.floatDur}s ease-in-out ${bd.floatDelay}s infinite` }}>
                    <BookCover src={selectedImages[i]} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Scroll to explore indicator ── */}
          {!isMobile && (
            <motion.div
              style={{
                position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)",
                opacity: scOp, zIndex: 5,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a8060" }}>
                Scroll to explore
              </span>
              <div style={{ animation: "scrollBounce 1.6s ease-in-out infinite" }}>
                <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                  <path d="M1 1.5L8 8.5L15 1.5" stroke="#b8a888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>
          )}

          {/* ── Bottom fade — hero blends into espresso section ── */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 220,
            background: "linear-gradient(to bottom, transparent 0%, #2D241E 100%)",
            pointerEvents: "none", zIndex: 10,
          }} />
        </div>
      </div>

      {/* ── Espresso dark section — upload card ── */}
      <div style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        background: "#2D241E",
        padding: isMobile ? "48px 24px 72px" : "80px 24px 110px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(244,197,66,0.7)", marginBottom: 32 }}>
            Digitize your cookbooks
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: isDragging ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: isDragging ? "1px solid rgba(244,197,66,0.45)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: isMobile ? "36px 24px" : "52px 40px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
            }}
          >
            {/* Saffron line-art camera icon */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 11L16.5 15.5H9C7.6 15.5 6.5 16.6 6.5 18V38C6.5 39.4 7.6 40.5 9 40.5H43C44.4 40.5 45.5 39.4 45.5 38V18C45.5 16.6 44.4 15.5 43 15.5H35.5L32.5 11H19.5Z" stroke="#F4C542" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="26" cy="28.5" r="7.5" stroke="#F4C542" strokeWidth="1.4" />
                <circle cx="38.5" cy="21.5" r="2" fill="#F4C542" />
              </svg>
            </div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: "#FDFBF1", marginBottom: 10, lineHeight: 1.3 }}>
              Photograph a cookbook page
            </p>
            <p style={{ color: "rgba(253,251,241,0.5)", fontSize: 14, fontFamily: "'Inter', sans-serif", lineHeight: 1.6, marginBottom: 8 }}>
              Drop here, or tap to choose an image
            </p>
            <p style={{ color: "rgba(253,251,241,0.3)", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
              JPG · PNG · HEIC — Claude will extract the full recipe
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
          </div>
        </div>
      </div>
    </>
  );
}

const generateRecipeImage = async (recipe) => {
  const directions = ["top-right", "top-left", "bottom-right", "bottom-left"];
  const randomDirection = directions[Math.floor(Math.random() * directions.length)];
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
  const randomProp = props[Math.floor(Math.random() * props.length)];
  const basePrompt = `A professional, top-down, centered, flat-lay food photograph of a perfectly round plate with ${recipe.title} arranged as described in the recipe: ${recipe.description || recipe.title}. The plate is centered against a seamless and full-frame background of a tablecloth or surface that matches the cultural style of this dish (${recipe.cuisine || "international"} cuisine). To the ${randomDirection} of the plate, place ${randomProp}. The entire frame is a square and looks like a clean, single image taken for a recipe book.`;

  // Build multimodal parts — include cookbook photo as visual reference when available
  const parts = [];
  if (recipe.imageUrl && recipe.imageUrl.startsWith("data:")) {
    const commaIdx = recipe.imageUrl.indexOf(",");
    const header   = recipe.imageUrl.slice(0, commaIdx);
    const b64data  = recipe.imageUrl.slice(commaIdx + 1);
    const mimeType = header.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
    parts.push({ inlineData: { mimeType, data: b64data } });
    parts.push({
      text: `The image above is the original cookbook photo for this recipe. Use it as a visual reference — match the dish's appearance, colour palette, plating style, and food presentation as closely as possible in the generated image. Now generate: ${basePrompt}`,
    });
  } else {
    parts.push({ text: basePrompt });
  }

  const response = await fetch(
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
  const data = await response.json();
  console.log("[Gemini Image] response:", JSON.stringify(data).slice(0, 500));
  const b64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  return b64 ? `data:image/png;base64,${b64}` : null;
};

// --- Shared Supabase + Gemini image cache ---
const fetchCachedImage = async (cacheKey) => {
  const { data } = await supabase
    .from("ingredient_images")
    .select("image_data")
    .eq("name", cacheKey)
    .maybeSingle();
  return data?.image_data ?? null;
};

const storeCachedImage = async (cacheKey, url) => {
  await supabase
    .from("ingredient_images")
    .upsert({ name: cacheKey, image_data: url }, { onConflict: "name" });
};

const generateGeminiImage = async (prompt) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );
  const data = await res.json();
  const b64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  return b64 ? `data:image/png;base64,${b64}` : null;
};

const generateIngredientImage = async (name, amount, unit) => {
  const safeAmount = (amount ?? "").toString().trim();
  const safeUnit  = (unit   ?? "").toString().trim().toLowerCase();
  const key = `ing:${name.toLowerCase().trim()}:${safeAmount}:${safeUnit}`;
  const cached = await fetchCachedImage(key);
  if (cached) return cached;

  // Units that represent discrete, countable items
  const countableUnits = new Set([
    "", "whole", "piece", "pieces", "pcs", "pc",
    "slice", "slices", "clove", "cloves",
    "sprig", "sprigs", "leaf", "leaves",
    "stalk", "stalks", "head", "heads",
    "bunch", "bunches", "strip", "strips",
  ]);
  // Units that are included verbatim in the description (not "insignificant")
  const insignificantUnits = new Set(["whole", "piece", "pieces", "pcs", "pc"]);

  const isCountable = countableUnits.has(safeUnit);
  const numAmount   = parseFloat(safeAmount);
  const isWholeNum  = !isNaN(numAmount) && Number.isInteger(numAmount) && numAmount >= 1 && numAmount <= 12;

  let subject;
  if (isCountable && isWholeNum) {
    // e.g. "exactly 2 eggs"  or  "exactly 3 cloves of garlic"
    const unitPart = safeUnit && !insignificantUnits.has(safeUnit) ? ` ${safeUnit} of` : "";
    subject = `exactly ${numAmount}${unitPart} ${name}`;
  } else if (safeAmount && safeUnit) {
    // e.g. "200 g of flour"
    subject = `${safeAmount} ${safeUnit} of ${name}`;
  } else if (safeAmount) {
    // e.g. "0.5 lemon"
    subject = `${safeAmount} ${name}`;
  } else {
    subject = name;
  }

  const prompt = `Minimalist, clean, top-down food photography of ${subject} on a pure white background. No text, no labels, soft natural lighting, cookbook style.`;
  const url = await generateGeminiImage(prompt);
  if (url) await storeCachedImage(key, url);
  return url;
};

const generateEquipmentImage = async (name) => {
  const key = `eq:${name.toLowerCase().trim()}`;
  const cached = await fetchCachedImage(key);
  if (cached) return cached;
  const prompt = `Minimalist, clean product photograph of a ${name} kitchen tool on a pure white background. Single item only, no text, no labels, soft studio lighting, cookbook style.`;
  const url = await generateGeminiImage(prompt);
  if (url) await storeCachedImage(key, url);
  return url;
};

// Canvas-based background removal: samples the 4 corner pixels to detect the
// actual background colour (handles off-white / light-grey Gemini outputs),
// then fades out pixels whose colour is close to that background.
const removeBackground = (dataUrl) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const W = canvas.width, H = canvas.height;

      // Average the 4 corners to detect the background colour
      const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i+1], d[i+2]]; };
      const corners = [px(0,0), px(W-1,0), px(0,H-1), px(W-1,H-1)];
      const bg = corners.reduce((s, c) => [s[0]+c[0], s[1]+c[1], s[2]+c[2]], [0,0,0]).map(v => v / 4);

      const T = 40, F = 25; // colour-distance threshold and feather range
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i]-bg[0])**2 + (d[i+1]-bg[1])**2 + (d[i+2]-bg[2])**2);
        if (dist < T + F) {
          d[i+3] = dist < T ? 0 : Math.round(((dist - T) / F) * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl); // fallback: return original unchanged
    img.src = dataUrl;
  });

// Shared thumbnail component
const ItemThumb = ({ name, fetchFn, amount, unit, size = 44, spinnerSize = 16, delay = 0 }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (src) return;
    let alive = true;
    const timer = setTimeout(() => {
      fetchFn(name, amount, unit)
        .then(async (url) => {
          if (!alive) return;
          if (url) {
            const clean = await removeBackground(url);
            if (alive) { setSrc(clean); setLoading(false); }
          } else {
            if (alive) setLoading(false);
          }
        })
        .catch(() => { if (alive) setLoading(false); });
    }, delay);
    return () => { alive = false; clearTimeout(timer); };
  }, [name, amount, unit, delay, fetchFn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? (
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : loading ? (
        <div style={{ width: spinnerSize, height: spinnerSize, border: "2px solid #e8ddc8", borderTopColor: "#b5622a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      ) : null}
    </div>
  );
};

// size is exposed so step-chips can request a smaller thumbnail (e.g. size=28)
const IngredientThumb = ({ name, amount, unit, size = 72, delay = 0 }) =>
  <ItemThumb name={name} amount={amount} unit={unit} fetchFn={generateIngredientImage}
    size={size} spinnerSize={Math.round(size * 0.28)} delay={delay} />;

const EquipmentThumb = ({ name, size = 60, delay = 0 }) =>
  <ItemThumb name={name} fetchFn={generateEquipmentImage}
    size={size} spinnerSize={Math.round(size * 0.3)} delay={delay} />;

// Continuously cycles through `messages`, fading each one in and out,
// until `isActive` becomes false.
const FadingTextLoader = ({ messages, isActive }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Reset to the first message whenever the message set changes (phase switch)
  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [messages]);

  // After each message has been fully visible for ~3.2 s, start fading it out
  useEffect(() => {
    if (!isActive) return;
    const fadeOut = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(fadeOut);
  }, [index, isActive]);

  // Once the fade-out transition (0.5 s) is done, advance to the next message
  useEffect(() => {
    if (!isActive || visible) return;
    const advance = setTimeout(() => {
      setIndex(i => (i + 1) % messages.length);
      setVisible(true);
    }, 500);
    return () => clearTimeout(advance);
  }, [visible, isActive, messages.length]);

  if (!isActive) return null;

  return (
    <div style={{ textAlign: "center", marginTop: 32, minHeight: 56 }}>
      <p
        style={{
          fontSize: 16,
          fontStyle: "italic",
          color: "#9a8060",
          maxWidth: 440,
          margin: "0 auto",
          lineHeight: 1.6,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        {messages[index]}
      </p>
    </div>
  );
};

const LOADING_PARTICLES = [
  { emoji: "🌿", left: "7%",  delay: "0s",   dur: "3.6s" },
  { emoji: "✨", left: "25%", delay: "1.2s", dur: "2.9s" },
  { emoji: "🌾", left: "50%", delay: "0.6s", dur: "3.9s" },
  { emoji: "🫙", left: "68%", delay: "2.0s", dur: "3.2s" },
  { emoji: "⭐", left: "83%", delay: "0.3s", dur: "2.7s" },
  { emoji: "🍋", left: "38%", delay: "2.5s", dur: "3.3s" },
];

const RecipeLoadingScreen = ({ extracting, translating, generatingImage, messages }) => {
  const isActive = extracting || translating || generatingImage;
  if (!isActive) return null;

  const mainIcon = extracting ? "📖" : translating ? "🌐" : "🎨";
  const steps = [
    { icon: "📖", label: "Reading",    active: extracting,       done: !extracting },
    { icon: "🌐", label: "Translating", active: translating,     done: !translating && !extracting },
    { icon: "🎨", label: "Composing",   active: generatingImage, done: false },
  ];

  return (
    <div style={{ textAlign: "center", padding: "28px 0 0", position: "relative", minHeight: 280, overflow: "hidden" }}>

      {/* Floating food particles */}
      {LOADING_PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            bottom: 0,
            left: p.left,
            fontSize: 20,
            animation: `float ${p.dur} ${p.delay} ease-in infinite`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* Phase stepper */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: step.done ? "#b5622a" : step.active ? "#fdf4eb" : "#f0e8d8",
                  border: `2px solid ${step.active || step.done ? "#b5622a" : "#d4c5a9"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: step.done ? 18 : 20,
                  color: step.done ? "#fff" : "inherit",
                  boxShadow: step.active ? "0 0 0 4px #b5622a33" : "none",
                  transition: "all 0.4s ease",
                }}
              >
                {step.done ? "✓" : step.icon}
              </div>
              <span style={{ fontSize: 12, color: step.active ? "#b5622a" : "#9a8060", fontWeight: step.active ? 600 : 400 }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="stepper-connector"
                style={{
                  background: steps[i + 1].done || steps[i + 1].active
                    ? "linear-gradient(90deg, #b5622a, #c8a97e)"
                    : step.active
                      ? "linear-gradient(90deg, #b5622a 25%, #e8ddc8 75%)"
                      : "#e8ddc8",
                  backgroundSize: "200% 100%",
                  animation: step.active ? "shimmer 1.4s linear infinite" : "none",
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Pulsing icon with ripple rings */}
      <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
        <div
          style={{
            position: "absolute",
            inset: -16,
            borderRadius: "50%",
            border: "2px solid #b5622a66",
            animation: "ripple 2s ease-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -16,
            borderRadius: "50%",
            border: "2px solid #b5622a44",
            animation: "ripple 2s ease-out 0.9s infinite",
          }}
        />
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fdf4eb, #f0e0c8)",
            border: "2px solid #d4a878",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            animation: "pulse 1.8s ease-in-out infinite",
            boxShadow: "0 4px 20px #b5622a22",
          }}
        >
          {mainIcon}
        </div>
      </div>

      {/* Bouncing dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#b5622a",
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Fading contextual messages */}
      <FadingTextLoader messages={messages} isActive={isActive} />
    </div>
  );
};

const getRecipeInLang = (recipe, lang) => {
  if (lang === "en" || !recipe.translations?.[lang]) return recipe;
  const t = recipe.translations[lang];
  return {
    ...recipe,
    title: t.title ?? recipe.title,
    description: t.description ?? recipe.description,
    ingredients: recipe.ingredients?.map((ing, i) => ({
      ...ing,
      name: t.ingredients?.[i]?.name ?? ing.name,
      note: t.ingredients?.[i]?.note ?? ing.note,
    })),
    steps: recipe.steps?.map((step, i) => ({
      ...step,
      instruction: t.steps?.[i]?.instruction ?? step.instruction,
    })),
    notes: t.notes ?? recipe.notes,
    tags: t.tags ?? recipe.tags,
    category: t.category ?? recipe.category,
  };
};

export default function RecipeApp() {
  const [recipes, setRecipes] = useState(SAMPLE_RECIPES);
  const [view, setView] = useState("library"); // library | digitize | detail
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [extracting, setExtracting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState([]); // array of dataUrls
  const [extractedRecipe, setExtractedRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [exportedRecipe, setExportedRecipe] = useState(null);
  const [viewLang, setViewLang] = useState("en");
  const [contextualMessages, setContextualMessages] = useState(null);
  const [cookMode, setCookMode]   = useState(null);  // recipe object | null
  const [cookStep, setCookStep]   = useState(-1);    // -1=intro, 0..N-1=steps, N=done
  const fileRef = useRef();

  // Cook mode keyboard navigation
  useEffect(() => {
    if (!cookMode) return;
    const totalSteps = cookMode.steps?.length ?? 0;
    const handler = (e) => {
      if (e.key === "Escape") { setCookMode(null); setCookStep(-1); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCookStep(s => Math.min(s + 1, totalSteps));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCookStep(s => Math.max(s - 1, -1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cookMode]);

  const categories = ["All", ...new Set(recipes.map(r => r.category).filter(Boolean))];

  const filtered = recipes.filter(r => {
    const matchesSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  // Handles one or more image files. Sends all images to Claude in a single
  // API call and lets the model decide how many recipes are present.
  const handleImagesUpload = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type.startsWith("image/"));
    if (files.length === 0) return;

    setError(null);
    setExtractedRecipe(null);
    setViewLang("en");

    // Read all files as base64 + dataUrl in parallel
    const fileData = await Promise.all(
      files.map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve({
          base64: e.target.result.split(",")[1],
          dataUrl: e.target.result,
          mediaType: file.type,
        });
        reader.readAsDataURL(file);
      }))
    );

    setPreviewImages(fileData.map(f => f.dataUrl));
    setContextualMessages(null);
    setExtracting(true);

    // Fire a cheap haiku call in parallel to generate image-specific loading messages.
    // Haiku finishes in ~2–5 s; the generic fallback array covers the gap until it responds.
    generateContextualExtractionMessages(fileData)
      .then(msgs => { if (Array.isArray(msgs)) setContextualMessages(msgs); })
      .catch(() => {});

    try {
      // Build a single Claude message containing ALL images + the extraction prompt
      const content = [
        ...fileData.map(f => ({
          type: "image",
          source: { type: "base64", media_type: f.mediaType, data: f.base64 },
        })),
        { type: "text", text: extractRecipesPrompt() },
      ];

      const result = await callAPI([{ role: "user", content }], Math.max(4000, files.length * 3000));
      // Claude returns an array; guard against it returning a plain object
      const recipesArray = Array.isArray(result) ? result : [result];

      const now = Date.now();
      const newRecipes = recipesArray.map((parsed, idx) => ({
        ...parsed,
        id: now + idx,
        addedAt: new Date().toISOString(),
        imageUrl: fileData[0].dataUrl, // use first photo as the source image
      }));

      setExtracting(false);
      setContextualMessages(null);
      setTranslating(true);
      setGeneratingImage(true);

      // Generate translation-phase messages specific to the extracted recipe title(s)
      generateContextualTranslationMessages(newRecipes)
        .then(msgs => { if (Array.isArray(msgs)) setContextualMessages(msgs); })
        .catch(() => {});

      // Fan out: translations + recipe image gen for EVERY recipe, all in parallel
      await Promise.all(newRecipes.map(async (recipe) => {
        const [deResult, frResult, imageResult] = await Promise.allSettled([
          translateRecipe(recipe, "de"),
          translateRecipe(recipe, "fr"),
          generateRecipeImage(recipe),
        ]);
        recipe.translations = {};
        if (deResult.status === "fulfilled") recipe.translations.de = deResult.value;
        if (frResult.status === "fulfilled") recipe.translations.fr = frResult.value;
        if (imageResult.status === "fulfilled" && imageResult.value) recipe.generatedImageUrl = imageResult.value;
      }));

      setRecipes(prev => [...newRecipes, ...prev]);
      setPreviewImages([]);
      setExtractedRecipe(null);

      if (newRecipes.length === 1) {
        // Single recipe → go straight to its detail page
        setSelectedRecipe(newRecipes[0]);
        setView("detail");
      } else {
        // Multiple recipes → land on the library so the user sees them all
        setView("library");
      }
    } catch (err) {
      setError(err.message || "Extraction failed. Please try again.");
    } finally {
      setExtracting(false);
      setTranslating(false);
      setGeneratingImage(false);
    }
  }, []);

  const exportCookidoo = (recipe) => {
    const tm = {
      "@type": "Recipe",
      "name": recipe.title,
      "description": recipe.description,
      "recipeYield": recipe.servings ? `${recipe.servings} servings` : "4 servings",
      "prepTime": recipe.prepTime ? `PT${recipe.prepTime}M` : null,
      "cookTime": recipe.cookTime ? `PT${recipe.cookTime}M` : null,
      "recipeCategory": recipe.category,
      "keywords": recipe.tags?.join(", "),
      "recipeIngredient": recipe.ingredients?.map(i =>
        `${i.amount || ""} ${i.unit || ""} ${i.name}${i.note ? ` (${i.note})` : ""}`.trim()
      ),
      "recipeInstructions": recipe.steps?.map((s, idx) => ({
        "@type": "HowToStep",
        "position": s.step || idx + 1,
        "text": s.instruction,
        ...(s.duration ? { "timeRequired": `PT${s.duration}M` } : {}),
        ...(s.temp ? { "temperature": `${s.temp}°C` } : {}),
      })),
      "source": recipe.source,
      "notes": recipe.notes,
    };
    const blob = new Blob([JSON.stringify(tm, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.title.replace(/\s+/g, "_")}_cookidoo.json`;
    a.click();
    setExportedRecipe(recipe.id);
    setTimeout(() => setExportedRecipe(null), 3000);
  };

  const deleteRecipe = (id) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
    if (selectedRecipe?.id === id) { setSelectedRecipe(null); setView("library"); }
  };

  const LangTabs = ({ hasTranslations }) => (
    <div className="lang-tabs-row">
      {LANGUAGES.map(l => {
        const available = l.code === "en" || hasTranslations;
        return (
          <button
            key={l.code}
            onClick={() => available && setViewLang(l.code)}
            style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: "1.5px solid",
              borderColor: viewLang === l.code ? "#b5622a" : "#d4c5a9",
              background: viewLang === l.code ? "#b5622a" : "transparent",
              color: viewLang === l.code ? "#faf7f2" : available ? "#7a6040" : "#c8bba8",
              cursor: available ? "pointer" : "not-allowed",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: viewLang === l.code ? 600 : 400,
              transition: "all 0.2s",
            }}
            title={!available ? "Translations not yet available" : undefined}
          >
            {l.flag} {l.label}
          </button>
        );
      })}
      {translating && (
        <span style={{ alignSelf: "center", marginLeft: 8, fontSize: 13, color: "#9a8060", fontStyle: "italic" }}>
          Translating…
        </span>
      )}
    </div>
  );

  const isProcessing = extracting || translating || generatingImage;

  return (
    <div style={{
      minHeight: "100vh",
      background: "transparent",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#2c2416",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&family=Playfair+Display:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FDFBF1; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f0ebe0; }
        ::-webkit-scrollbar-thumb { background: #c8a97e; border-radius: 3px; }
        .card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(44,36,22,0.12); }
        .btn-primary { background: #b5622a; color: #faf7f2; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.01em; transition: background 0.2s; }
        .btn-primary:hover { background: #8f4a1e; }
        .btn-ghost { background: transparent; border: 1.5px solid #c8a97e; color: #2c2416; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; transition: all 0.2s; }
        .btn-ghost:hover { background: #c8a97e22; }
        .drop-zone { border: 2px dashed #c8a97e; border-radius: 8px; padding: 48px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fdf9f3; }
        .drop-zone:hover, .drop-zone.active { border-color: #b5622a; background: #fdf4eb; }
        .tag { display: inline-block; background: #e8ddc8; color: #5a4020; padding: 2px 10px; border-radius: 20px; font-size: 13px; margin: 2px; }
        .nav-tab { padding: 8px 20px; cursor: pointer; border-bottom: 2px solid transparent; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500; color: #7a6040; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s; }
        .nav-tab.active { border-bottom-color: #b5622a; color: #b5622a; font-weight: 600; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid #d4c5a9; border-radius: 4px; font-family: 'Inter', sans-serif; font-size: 15px; background: #fdf9f3; color: #2c2416; outline: none; }
        .input:focus { border-color: #b5622a; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 32px; height: 32px; border: 3px solid #e8ddc8; border-top-color: #b5622a; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes ripple { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
        @keyframes float { 0% { opacity: 0; transform: translateY(0) scale(0.8); } 20% { opacity: 1; } 80% { opacity: 0.6; } 100% { opacity: 0; transform: translateY(-120px) scale(1.1); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes blobDrift1 { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.80; } 33% { transform: translate(40px,-30px) scale(1.05); opacity: 0.95; } 66% { transform: translate(-20px,20px) scale(0.97); opacity: 0.62; } }
        @keyframes blobDrift2 { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.68; } 33% { transform: translate(-50px,30px) scale(1.08); opacity: 0.88; } 66% { transform: translate(30px,-20px) scale(0.95); opacity: 0.52; } }
        @keyframes blobDrift3 { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.58; } 33% { transform: translate(25px,40px) scale(1.03); opacity: 0.78; } 66% { transform: translate(-35px,-25px) scale(1.06); opacity: 0.45; } }
        @keyframes bookFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes scrollBounce { 0%,100% { transform: translateY(0); opacity: 0.7; } 50% { transform: translateY(6px); opacity: 1; } }

        /* ── Base layout classes (desktop defaults) ── */
        .site-header { padding: 12px 24px; gap: 10px; position: relative; }
        .header-buttons { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 24px; }
        .main-content { padding: 32px 24px; }
        .library-top { flex-direction: row; align-items: flex-start; }
        .info-grid { grid-template-columns: repeat(3, 1fr); }
        .detail-img { height: 300px; overflow: hidden; }
        .detail-body { padding: 28px 32px; }
        .detail-title { font-size: 34px; line-height: 1.2; font-family: 'Playfair Display', serif; }
        .detail-grid { grid-template-columns: 1fr 1.6fr; gap: 32px; display: grid; }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0ebe0; }
        .stepper-connector { width: 56px; height: 2px; margin-bottom: 20px; flex-shrink: 0; }
        .lang-tabs-row { display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; }

        /* ── Cook Mode Overlay ── */
        .cook-overlay { position: fixed; inset: 0; z-index: 9999; background: #0e0804; display: flex; flex-direction: column; }
        .cook-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid #1e1208; flex-shrink: 0; }
        .cook-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; position: relative; overflow: hidden; cursor: pointer; }
        .cook-instruction { font-family: 'Crimson Text', serif; color: #faf7f2; text-align: center; line-height: 1.5; max-width: 780px; font-size: clamp(26px, 5vw, 50px); }
        .cook-instruction strong { color: #c8916a; }
        .cook-chip { display: flex; align-items: center; gap: 6px; background: #1a0e06; border: 1px solid #3a2418; border-radius: 20px; padding: 4px 12px 4px 4px; font-size: 14px; color: #c8b090; }
        @keyframes cookFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .cook-step-enter { animation: cookFadeUp 0.38s cubic-bezier(.22,.68,0,1.2) both; }
        @keyframes cookPulse { 0%,100% { opacity: .25 } 50% { opacity: .6 } }
        .cook-arrow { font-size: 28px; position: absolute; top: 50%; transform: translateY(-50%); color: #3a2418; animation: cookPulse 2.5s ease infinite; pointer-events: none; user-select: none; }

        /* ── Mobile overrides (≤ 640 px) ── */
        @media (max-width: 640px) {
          .site-header { padding: 10px 14px; }
          .header-buttons { padding: 6px 14px; }
          .main-content { padding: 16px 14px; }
          .drop-zone { padding: 28px 16px; }
          .library-top { flex-direction: column; align-items: stretch; gap: 10px; }
          .library-top .input { max-width: 100% !important; }
          .info-grid { grid-template-columns: 1fr; }
          .detail-grid { grid-template-columns: 1fr; gap: 20px; }
          .detail-img { height: 200px; }
          .detail-body { padding: 18px 14px; }
          .detail-title { font-size: 24px; }
          .action-row { flex-direction: column; }
          .btn-primary { padding: 12px 20px; font-size: 13px; }
          .btn-ghost { padding: 10px 16px; font-size: 13px; }
          .nav-tab { padding: 8px 12px; font-size: 11px; }
          .tag { font-size: 12px; padding: 2px 7px; }
          .stepper-connector { width: 24px; }
        }
      `}</style>

      {/* ── Global mesh gradient background — fixed, starts 10vh down so header stays clean ── */}
      <div style={{ position: "fixed", top: "10vh", left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Sage blob — upper left */}
        <div style={{ position: "absolute", top: "-8%", left: "4%", width: 720, height: 720, background: "radial-gradient(circle, rgba(226,232,213,0.72) 0%, transparent 68%)", filter: "blur(120px)", borderRadius: "50%", animation: "blobDrift1 14s ease-in-out infinite", willChange: "transform" }} />
        {/* Sage blob — right */}
        <div style={{ position: "absolute", top: "26%", right: "2%", width: 600, height: 600, background: "radial-gradient(circle, rgba(226,232,213,0.58) 0%, transparent 68%)", filter: "blur(100px)", borderRadius: "50%", animation: "blobDrift2 18s ease-in-out infinite", willChange: "transform" }} />
        {/* Saffron accent blob — bottom center */}
        <div style={{ position: "absolute", bottom: "6%", left: "20%", width: 520, height: 520, background: "radial-gradient(circle, rgba(244,197,66,0.24) 0%, transparent 68%)", filter: "blur(110px)", borderRadius: "50%", animation: "blobDrift3 22s ease-in-out infinite", willChange: "transform" }} />
        {/* Sage blob — mid (4th orb for depth) */}
        <div style={{ position: "absolute", top: "54%", left: "38%", width: 440, height: 440, background: "radial-gradient(circle, rgba(226,232,213,0.42) 0%, transparent 68%)", filter: "blur(100px)", borderRadius: "50%", animation: "blobDrift1 28s ease-in-out 6s infinite", willChange: "transform" }} />
      </div>

      {/* ── Top bar ── */}
      <header className="site-header" style={{ background: "rgba(253,251,241,0.30)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "none", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        {/* Hamburger */}
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 6, display: "flex", flexDirection: "column", gap: 4.5, alignItems: "flex-start" }}>
          <span style={{ display: "block", width: 22, height: 2, background: "#2c2416", borderRadius: 2 }} />
          <span style={{ display: "block", width: 22, height: 2, background: "#2c2416", borderRadius: 2 }} />
          <span style={{ display: "block", width: 15, height: 2, background: "#2c2416", borderRadius: 2 }} />
        </button>

        {/* Logo + name — absolutely centred */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 9, pointerEvents: "none" }}>
          <img src="/favicon.png" alt="" style={{ height: 30, width: "auto" }} />
          <span style={{ fontWeight: 700, fontSize: 20, color: "#1a1208", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "-0.4px" }}>
            Cookable
          </span>
        </div>

        {/* Profile placeholder */}
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#e8ddc8", border: "2px solid #d4c5a9", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="#b8a888" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#b8a888" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </header>


      <main className="main-content" style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* LIBRARY VIEW */}
        {view === "library" && (
          <div className="fade-in">
            {recipes.length === 0 ? (
              <EmptyStateHero onFiles={(files) => { handleImagesUpload(files); setView("digitize"); }} />
            ) : (
              <>
                <div className="library-top" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  <input className="input" placeholder="Search recipes, ingredients, tags…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid", borderColor: activeCategory === cat ? "#b5622a" : "#d4c5a9", background: activeCategory === cat ? "#b5622a" : "transparent", color: activeCategory === cat ? "#faf7f2" : "#7a6040", cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", transition: "all 0.2s" }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                  {filtered.map(recipe => (
                <div key={recipe.id} className="card" onClick={() => { setSelectedRecipe(recipe); setView("detail"); setViewLang("en"); }} style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}>
                  {(recipe.generatedImageUrl || recipe.imageUrl) && (
                    <div style={{ height: 160, overflow: "hidden", background: "#e8ddc8" }}>
                      <img src={recipe.generatedImageUrl || recipe.imageUrl} alt={recipe.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, lineHeight: 1.3 }}>{recipe.title}</h3>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {recipe.thermomixAdapted && <span style={{ fontSize: 18 }} title="Thermomix adapted">🌀</span>}
                        {recipe.translations && Object.keys(recipe.translations).length > 0 && (
                          <span style={{ fontSize: 12, color: "#9a8060" }} title="Available in multiple languages">🌐</span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: "#7a6040", lineHeight: 1.5, marginBottom: 10 }}>{recipe.description?.substring(0, 80)}{recipe.description?.length > 80 ? "…" : ""}</p>
                    <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#9a8060", marginBottom: 10 }}>
                      {recipe.prepTime && <span>⏱ {recipe.prepTime}min prep</span>}
                      {recipe.cookTime && <span>🔥 {recipe.cookTime}min cook</span>}
                      {recipe.servings && <span>👥 {recipe.servings}</span>}
                    </div>
                    <div>{recipe.tags?.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}</div>
                  </div>
                </div>
              ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* DIGITIZE VIEW */}
        {view === "digitize" && (
          <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 6 }}>Digitize a Recipe</h2>
            <p style={{ color: "#7a6040", marginBottom: 28, fontSize: 16 }}>Photograph one or more cookbook pages — Claude will detect how many recipes are present and extract them all automatically.</p>

            {/* Drop zone — shown only before any images are selected */}
            {previewImages.length === 0 && (
              <div
                className="drop-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("active"); }}
                onDragLeave={e => e.currentTarget.classList.remove("active")}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("active"); handleImagesUpload(e.dataTransfer.files); }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Drop photos here</p>
                <p style={{ color: "#9a8060", fontSize: 15 }}>or click to choose — select multiple to scan several recipes at once</p>
                <p style={{ color: "#b8a888", fontSize: 13, marginTop: 12 }}>JPG, PNG, HEIC — works with any cookbook page</p>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImagesUpload(e.target.files)} />
              </div>
            )}

            {/* Preview + processing state */}
            {previewImages.length > 0 && (
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                {/* Hidden file input for "Try different" */}
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImagesUpload(e.target.files)} />

                {/* Image previews — hidden while processing to make room for the loading screen */}
                {!isProcessing && (previewImages.length === 1 ? (
                  <img
                    src={previewImages[0]}
                    alt="Cookbook page"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #e8ddc8" }}
                  />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                    {previewImages.map((src, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img
                          src={src}
                          alt={`Page ${i + 1}`}
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: "1px solid #e8ddc8", display: "block" }}
                        />
                        <span style={{
                          position: "absolute", bottom: 6, right: 6,
                          background: "#2c2416cc", color: "#faf7f2",
                          fontSize: 11, padding: "2px 6px", borderRadius: 4,
                        }}>
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Animated loading screen while processing */}
                <RecipeLoadingScreen
                  extracting={extracting}
                  translating={translating}
                  generatingImage={generatingImage}
                  messages={extracting
                    ? (contextualMessages ?? EXTRACTION_MESSAGES)
                    : (contextualMessages ?? TRANSLATION_MESSAGES)}
                />

                {/* Error state */}
                {error && (
                  <div style={{ background: "#fdf0e8", border: "1px solid #e8c4a0", borderRadius: 8, padding: 20, marginTop: 16 }}>
                    <p style={{ color: "#8f4a1e", fontWeight: 600, marginBottom: 8 }}>Extraction failed</p>
                    <p style={{ color: "#7a4030", fontSize: 15 }}>{error}</p>
                  </div>
                )}

                {/* Reset / retry button — only shown when not processing */}
                {!isProcessing && (
                  <button
                    className="btn-ghost"
                    style={{ marginTop: 12, width: "100%" }}
                    onClick={() => {
                      setPreviewImages([]);
                      setExtractedRecipe(null);
                      setError(null);
                      setViewLang("en");
                      fileRef.current?.click();
                    }}
                  >
                    Try different photo{previewImages.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}

            {/* Info cards — shown only before any images are selected */}
            {previewImages.length === 0 && (
              <div className="info-grid" style={{ marginTop: 40, display: "grid", gap: 16 }}>
                {[
                  { icon: "📸", title: "Photograph", text: "Take one or more photos of any cookbook page" },
                  { icon: "🤖", title: "AI Extracts", text: "Claude reads all images and detects each distinct recipe automatically" },
                  { icon: "🌐", title: "3 Languages", text: "Every recipe is auto-translated into English, German & French" },
                ].map(step => (
                  <div key={step.title} style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 8, padding: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, marginBottom: 6 }}>{step.title}</p>
                    <p style={{ fontSize: 14, color: "#9a8060", lineHeight: 1.5 }}>{step.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === "detail" && selectedRecipe && (() => {
          const r = getRecipeInLang(selectedRecipe, viewLang);
          return (
            <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
              <button onClick={() => setView("library")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8060", fontSize: 15, marginBottom: 20, padding: 0 }}>
                ← Back to library
              </button>

              <LangTabs hasTranslations={selectedRecipe.translations && Object.keys(selectedRecipe.translations).length > 0} />

              <div style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 12, overflow: "hidden" }}>
                {(selectedRecipe.generatedImageUrl || r.imageUrl) && (
                  <div className="detail-img">
                    <img src={selectedRecipe.generatedImageUrl || r.imageUrl} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div className="detail-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                    <h1 className="detail-title">{r.title}</h1>
                    {r.thermomixAdapted && <span style={{ fontSize: 24 }} title="Thermomix adapted">🌀</span>}
                  </div>
                  {r.source && <p style={{ color: "#9a8060", fontSize: 14, marginBottom: 12, fontStyle: "italic" }}>From: {r.source}</p>}
                  <p style={{ fontSize: 17, color: "#5a4020", lineHeight: 1.6, marginBottom: 20 }}>{r.description}</p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 15, color: "#7a6040", padding: "16px 0", borderTop: "1px solid #f0ebe0", borderBottom: "1px solid #f0ebe0", marginBottom: r.nutrition ? 12 : 24, alignItems: "center" }}>
                    {r.servings && <span>👥 {r.servings} servings</span>}
                    {r.prepTime && <span>⏱ {r.prepTime}min prep</span>}
                    {r.cookTime && <span>🔥 {r.cookTime}min cook</span>}
                    {r.category && <span>🏷 {r.category}</span>}
                    {r.difficulty && (
                      <span style={{
                        background: r.difficulty === "Easy" ? "#e8f5e9" : r.difficulty === "Medium" ? "#fff8e1" : "#fdecea",
                        color: r.difficulty === "Easy" ? "#2e7d32" : r.difficulty === "Medium" ? "#f57f17" : "#c62828",
                        borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 600
                      }}>
                        {r.difficulty === "Easy" ? "🟢" : r.difficulty === "Medium" ? "🟡" : "🔴"} {r.difficulty}
                      </span>
                    )}
                  </div>
                  {r.nutrition && (
                    <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                      {[
                        { label: "Calories", value: r.nutrition.calories, unit: "kcal", color: "#b5622a" },
                        { label: "Protein",  value: r.nutrition.protein,  unit: "g",    color: "#4a7c59" },
                        { label: "Fat",      value: r.nutrition.fat,      unit: "g",    color: "#7a6040" },
                        { label: "Carbs",    value: r.nutrition.carbs,    unit: "g",    color: "#5a6080" },
                      ].map(n => n.value != null && (
                        <div key={n.label} style={{ background: "#faf7f2", border: "1px solid #e8ddc8", borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 70 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: n.color }}>{n.value}<span style={{ fontSize: 11, fontWeight: 400 }}>{n.unit}</span></div>
                          <div style={{ fontSize: 11, color: "#9a8060", textTransform: "uppercase", letterSpacing: "0.4px" }}>{n.label}</div>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: "#b8a888", alignSelf: "flex-end", paddingBottom: 4 }}>per serving · estimated</div>
                    </div>
                  )}

                  <div className="detail-grid">
                    <div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Ingredients</h3>
                      <ul style={{ listStyle: "none" }}>
                        {r.ingredients?.map((ing, i) => (
                          <li key={i} style={{ padding: "7px 0", borderBottom: "1px solid #f5f0e8", fontSize: 15, display: "flex", gap: 10, alignItems: "center" }}>
                            <IngredientThumb name={ing.name} amount={ing.amount} unit={ing.unit} delay={i * 300} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, color: "#b5622a" }}>{ing.amount} {ing.unit}</span>
                              <span> {ing.name}{ing.note && <em style={{ color: "#9a8060", fontSize: 13 }}>, {ing.note}</em>}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {r.equipment?.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 10 }}>Equipment</h3>
                          <ul style={{ listStyle: "none" }}>
                            {r.equipment.map((item, i) => (
                              <li key={i} style={{ padding: "5px 0", borderBottom: "1px solid #f5f0e8", fontSize: 14, color: "#5a4020", display: "flex", gap: 8, alignItems: "center" }}>
                                <EquipmentThumb name={item} delay={i * 200} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Method</h3>
                      <ol style={{ listStyle: "none" }}>
                        {r.steps?.map((step, i) => {
                          const mentionedItems = getMentionedItems(step, r);
                          return (
                            <li key={i} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                              <span style={{ background: "#b5622a", color: "#faf7f2", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{step.step || i + 1}</span>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>{renderBold(step.instruction)}</p>
                                {mentionedItems.length > 0 && (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                    {mentionedItems.map((item, j) => (
                                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 4, background: "#faf7f2", border: "1px solid #e8ddc8", borderRadius: 20, padding: "2px 9px 2px 2px", fontSize: 12, color: "#5a4020", fontWeight: 500 }}>
                                        {item.type === "ingredient"
                                          ? <IngredientThumb name={item.name} amount={item.amount} unit={item.unit} size={28} delay={j * 80} />
                                          : <EquipmentThumb name={item.name} size={28} delay={j * 80} />
                                        }
                                        {item.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(step.duration || step.temp) && (
                                  <p style={{ fontSize: 13, color: "#9a8060", marginTop: 6 }}>
                                    {step.duration && `⏱ ${step.duration}min`} {step.temp && `🌡 ${step.temp}°C`}
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                      {r.notes && (
                        <div style={{ background: "#fdf9f0", border: "1px solid #e8ddc8", borderRadius: 6, padding: 14, marginTop: 16 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#b5622a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Chef's Notes</p>
                          <p style={{ fontSize: 14, color: "#5a4020", lineHeight: 1.6 }}>{r.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="action-row">
                    <button
                      className="btn-primary"
                      style={{ flex: 1, background: "#4a7c59", fontSize: 17 }}
                      onClick={() => { setCookMode(r); setCookStep(-1); }}
                    >
                      👨‍🍳 Start Cooking
                    </button>
                    <button className="btn-primary" onClick={() => exportCookidoo(r)} style={{ flex: 1 }}>
                      {exportedRecipe === selectedRecipe.id ? "✓ Downloaded!" : "🌀 Export for Cookidoo"}
                    </button>
                    <button className="btn-ghost" onClick={() => deleteRecipe(selectedRecipe.id)} style={{ color: "#c0503a", borderColor: "#c0503a55" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* ── Cook Mode Fullscreen Overlay ── */}
      {cookMode && (() => {
        const r = cookMode;
        const steps = r.steps || [];
        const totalSteps = steps.length;
        const isIntro = cookStep === -1;
        const isDone  = cookStep >= totalSteps;
        const step    = (!isIntro && !isDone) ? steps[cookStep] : null;
        const progress = isIntro ? 0 : isDone ? 100 : Math.round(((cookStep + 1) / totalSteps) * 100);
        const items = step ? getMentionedItems(step, r) : [];

        const exitCook = () => { setCookMode(null); setCookStep(-1); };
        const goNext = () => {
          if (isDone) exitCook();
          else setCookStep(s => s + 1);
        };
        const goPrev = () => setCookStep(s => Math.max(s - 1, -1));

        const handleBodyClick = (e) => {
          const pct = e.clientX / window.innerWidth;
          if (pct < 0.3 && !isIntro) goPrev();
          else goNext();
        };

        return (
          <div className="cook-overlay">
            {/* Progress bar */}
            <div style={{ height: 3, background: "#1a0e06", width: "100%", flexShrink: 0 }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "#b5622a", transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
            </div>

            {/* Header */}
            <div className="cook-header">
              <div>
                <p style={{ fontFamily: "'Playfair Display', serif", color: "#c8916a", fontSize: 13, letterSpacing: "0.8px", textTransform: "uppercase", margin: 0 }}>
                  {r.title}
                </p>
                <p style={{ color: "#5a4020", fontSize: 12, margin: "2px 0 0" }}>
                  {isIntro ? "Prepare your mise en place" : isDone ? "Complete!" : `Step ${cookStep + 1} of ${totalSteps}`}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); exitCook(); }}
                style={{ background: "none", border: "1px solid #2c2010", color: "#5a4020", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", letterSpacing: "0.03em" }}
              >
                ✕ Exit
              </button>
            </div>

            {/* Body — tap to navigate */}
            <div className="cook-body" onClick={handleBodyClick}>

              {/* Intro screen */}
              {isIntro && (
                <div className="cook-step-enter" style={{ textAlign: "center", maxWidth: 680, zIndex: 1 }}>
                  <p style={{ fontSize: 56, marginBottom: 16 }}>👨‍🍳</p>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#faf7f2", fontSize: "clamp(26px,5vw,44px)", marginBottom: 8 }}>
                    Ready to cook?
                  </h2>
                  <p style={{ color: "#5a4020", fontSize: 15, marginBottom: 28 }}>
                    Gather your ingredients before we start:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                    {r.ingredients?.map((ing, i) => (
                      <div key={i} className="cook-chip">
                        <IngredientThumb name={ing.name} amount={ing.amount} unit={ing.unit} size={34} delay={i * 60} />
                        <span>
                          <span style={{ color: "#b5622a", fontWeight: 600, marginRight: 4 }}>{ing.amount} {ing.unit}</span>
                          {ing.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ color: "#3a2418", fontSize: 14, marginTop: 36, letterSpacing: "0.5px" }}>
                    TAP ANYWHERE TO BEGIN →
                  </p>
                </div>
              )}

              {/* Step screen */}
              {step && (
                <div key={cookStep} className="cook-step-enter" style={{ textAlign: "center", maxWidth: 780, zIndex: 1, pointerEvents: "none", padding: "0 48px" }}>
                  {/* Step circle */}
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#b5622a", color: "#faf7f2", fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontFamily: "'Playfair Display', serif", boxShadow: "0 0 0 8px #1e1008" }}>
                    {cookStep + 1}
                  </div>

                  {/* Instruction */}
                  <p className="cook-instruction">{renderBold(step.instruction)}</p>

                  {/* Duration / temp badges */}
                  {(step.duration || step.temp) && (
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
                      {step.duration && (
                        <span style={{ background: "#1a0e06", border: "1px solid #3a2418", borderRadius: 20, padding: "7px 18px", color: "#c8916a", fontSize: 17 }}>
                          ⏱ {step.duration} min
                        </span>
                      )}
                      {step.temp && (
                        <span style={{ background: "#1a0e06", border: "1px solid #3a2418", borderRadius: 20, padding: "7px 18px", color: "#c8916a", fontSize: 17 }}>
                          🌡 {step.temp}°C
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ingredient / equipment chips */}
                  {items.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 28 }}>
                      {items.map((item, j) => (
                        <div key={j} className="cook-chip">
                          {item.type === "ingredient"
                            ? <IngredientThumb name={item.name} amount={item.amount} unit={item.unit} size={30} delay={j * 60} />
                            : <EquipmentThumb name={item.name} size={30} delay={j * 60} />
                          }
                          {item.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Done screen */}
              {isDone && (
                <div className="cook-step-enter" style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 72, marginBottom: 12 }}>🎉</p>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#faf7f2", fontSize: "clamp(30px,5vw,52px)", margin: "0 0 12px" }}>
                    Bon appétit!
                  </h2>
                  <p style={{ color: "#5a4020", fontSize: 17, marginBottom: 36 }}>
                    {r.title} is ready to serve.
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); exitCook(); }}
                    style={{ background: "#b5622a", color: "#faf7f2", border: "none", padding: "14px 36px", borderRadius: 6, fontSize: 14, fontFamily: "'Inter', sans-serif", cursor: "pointer", fontWeight: 600, letterSpacing: "0.01em" }}
                  >
                    Back to recipe
                  </button>
                </div>
              )}

              {/* Directional hint arrows */}
              {!isDone && (
                <>
                  {!isIntro && <div className="cook-arrow" style={{ left: 20 }}>‹</div>}
                  <div className="cook-arrow" style={{ right: 20 }}>{cookStep === totalSteps - 1 ? "✓" : "›"}</div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
