import React, { useState, useRef, useCallback } from "react";

const SAMPLE_RECIPES = [];

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

const extractRecipePrompt = () => `You are an expert culinary editor. Extract the recipe from this cookbook page photo and return it as a JSON object ONLY — no markdown fences, no explanation, just raw JSON.

Apply these editorial standards as you extract:

INGREDIENTS — Mise en Place style: Integrate the preparation state directly into each ingredient so the cook knows exactly what to do before starting. Use the "note" field for all prep instructions (e.g. "finely diced", "room temperature", "toasted and ground", "cut into 2 cm cubes"). Never leave a vague entry like "1 onion" when you can write "1 medium onion, finely diced".

STEPS — Single-action focus: Break dense paragraphs into numbered steps with 1–2 actions each. Extract exact times into "duration" (minutes, number only) and temperatures into "temp" (Celsius, number only) as separate fields — do NOT repeat them in the instruction text. Describe visual/textural doneness cues clearly (e.g. "until golden brown and fragrant", "until the sauce coats the back of a spoon").

NUTRITION: If not shown, estimate per-serving macros from standard nutritional databases.

EQUIPMENT: Read the full method and list every specific tool, appliance, or vessel required (e.g. "fine-mesh sieve", "23×33 cm baking dish", "stand mixer").

DIFFICULTY: Easy = straightforward techniques, under 45 min active time. Medium = moderate skill or multi-step. Hard = advanced techniques, long process, or precision required.

Return this exact JSON structure:
{
  "title": "Recipe name",
  "description": "1–2 sentence description of the dish",
  "difficulty": "Easy | Medium | Hard",
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "category": "Main | Dessert | Starter | Soup | Bread | Salad | Snack | Drink | Other",
  "cuisine": "Italian | French | Asian | Middle Eastern | etc.",
  "tags": ["tag1", "tag2"],
  "source": "Book title or author if visible, else null",
  "equipment": ["large skillet", "fine-mesh sieve"],
  "nutrition": { "calories": 350, "protein": 25, "fat": 12, "carbs": 30 },
  "ingredients": [
    { "amount": "200", "unit": "g", "name": "ingredient", "note": "finely diced" }
  ],
  "steps": [
    { "step": 1, "instruction": "Single clear action", "duration": null, "temp": null }
  ],
  "thermomixAdapted": false,
  "notes": "Chef tips, variations, or serving suggestions"
}

Rules: return ONLY valid JSON. Use null for any unknown field. "thermomixAdapted": true only if you rewrite steps for Thermomix.`;

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

const callAPI = async (messages, maxTokens = 2000) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify({ model: "claude-opus-4-5", max_tokens: maxTokens, messages }),
  });
  const data = await response.json();
  const text = data.content?.find((b) => b.type === "text")?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

const translateRecipe = (recipe, targetLang) =>
  callAPI([{ role: "user", content: translateRecipePrompt(recipe, targetLang) }]);

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
  const prompt = `A professional, top-down, centered, flat-lay food photograph of a perfectly round plate with ${recipe.title} arranged as described in the recipe: ${recipe.description || recipe.title}. The plate is centered against a seamless and full-frame background of a tablecloth or surface that matches the cultural style of this dish (${recipe.cuisine || "international"} cuisine). To the ${randomDirection} of the plate, place ${randomProp}. The entire frame is a square and looks like a clean, single image taken for a recipe book.`;
  const response = await fetch(
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
  const data = await response.json();
  console.log("[Gemini Image] response:", JSON.stringify(data).slice(0, 500));
  const b64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  return b64 ? `data:image/png;base64,${b64}` : null;
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
  const [previewImage, setPreviewImage] = useState(null);
  const [extractedRecipe, setExtractedRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [exportedRecipe, setExportedRecipe] = useState(null);
  const [viewLang, setViewLang] = useState("en");
  const fileRef = useRef();

  const categories = ["All", ...new Set(recipes.map(r => r.category).filter(Boolean))];

  const filtered = recipes.filter(r => {
    const matchesSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setExtractedRecipe(null);
    setViewLang("en");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      const dataUrl = e.target.result;
      setPreviewImage(dataUrl);
      setExtracting(true);

      try {
        const parsed = await callAPI([{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
            { type: "text", text: extractRecipePrompt() },
          ],
        }]);

        parsed.id = Date.now();
        parsed.addedAt = new Date().toISOString();
        parsed.imageUrl = dataUrl;

        setExtracting(false);
        setTranslating(true);

        try {
          const [de, fr] = await Promise.all([
            translateRecipe(parsed, "de"),
            translateRecipe(parsed, "fr"),
          ]);
          parsed.translations = { de, fr };
        } catch {
          parsed.translations = {};
        }

        setTranslating(false);
        setGeneratingImage(true);

        try {
          const generatedImageUrl = await generateRecipeImage(parsed);
          if (generatedImageUrl) parsed.generatedImageUrl = generatedImageUrl;
        } catch {
          // fall back to cookbook photo
        }

        setExtractedRecipe(parsed);
      } catch (err) {
        setError(err.message || "Extraction failed. Please try again.");
      } finally {
        setExtracting(false);
        setTranslating(false);
        setGeneratingImage(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const saveRecipe = () => {
    if (!extractedRecipe) return;
    setRecipes(prev => [extractedRecipe, ...prev]);
    setPreviewImage(null);
    setExtractedRecipe(null);
    setView("library");
  };

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
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
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
              fontFamily: "'Crimson Text', serif",
              fontSize: 14,
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      fontFamily: "'Crimson Text', Georgia, serif",
      color: "#2c2416",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f0ebe0; }
        ::-webkit-scrollbar-thumb { background: #c8a97e; border-radius: 3px; }
        .card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(44,36,22,0.12); }
        .btn-primary { background: #b5622a; color: #faf7f2; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 16px; font-weight: 600; transition: background 0.2s; }
        .btn-primary:hover { background: #8f4a1e; }
        .btn-ghost { background: transparent; border: 1.5px solid #c8a97e; color: #2c2416; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 15px; transition: all 0.2s; }
        .btn-ghost:hover { background: #c8a97e22; }
        .drop-zone { border: 2px dashed #c8a97e; border-radius: 8px; padding: 48px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fdf9f3; }
        .drop-zone:hover, .drop-zone.active { border-color: #b5622a; background: #fdf4eb; }
        .tag { display: inline-block; background: #e8ddc8; color: #5a4020; padding: 2px 10px; border-radius: 20px; font-size: 13px; margin: 2px; }
        .nav-tab { padding: 8px 20px; cursor: pointer; border-bottom: 2px solid transparent; font-size: 15px; color: #7a6040; transition: all 0.2s; }
        .nav-tab.active { border-bottom-color: #b5622a; color: #b5622a; font-weight: 600; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid #d4c5a9; border-radius: 4px; font-family: 'Crimson Text', serif; font-size: 16px; background: #fdf9f3; color: #2c2416; outline: none; }
        .input:focus { border-color: #b5622a; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 32px; height: 32px; border: 3px solid #e8ddc8; border-top-color: #b5622a; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      {/* Header */}
      <header style={{ background: "#2c2416", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#faf7f2", fontWeight: 900, letterSpacing: "-0.5px" }}>
            Ma Cuisine
          </h1>
          <p style={{ color: "#c8a97e", fontSize: 13, marginTop: 2, fontStyle: "italic" }}>Your personal recipe library</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-ghost" style={{ borderColor: "#c8a97e55", color: "#c8a97e" }} onClick={() => { setView("library"); setPreviewImage(null); setExtractedRecipe(null); }}>
            📚 Library ({recipes.length})
          </button>
          <button className="btn-primary" onClick={() => { setView("digitize"); setPreviewImage(null); setExtractedRecipe(null); setError(null); setViewLang("en"); }}>
            + Digitize Recipe
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* LIBRARY VIEW */}
        {view === "library" && (
          <div className="fade-in">
            <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
              <input className="input" placeholder="Search recipes, ingredients, tags…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid", borderColor: activeCategory === cat ? "#b5622a" : "#d4c5a9", background: activeCategory === cat ? "#b5622a" : "transparent", color: activeCategory === cat ? "#faf7f2" : "#7a6040", cursor: "pointer", fontSize: 14, fontFamily: "'Crimson Text', serif", transition: "all 0.2s" }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {recipes.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 32px", color: "#9a8060" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📖</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 8 }}>Your library is empty</h2>
                <p style={{ fontSize: 17, marginBottom: 24 }}>Take a photo of a cookbook page to get started.</p>
                <button className="btn-primary" onClick={() => setView("digitize")}>Digitize your first recipe</button>
              </div>
            )}

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
          </div>
        )}

        {/* DIGITIZE VIEW */}
        {view === "digitize" && (
          <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 6 }}>Digitize a Recipe</h2>
            <p style={{ color: "#7a6040", marginBottom: 28, fontSize: 16 }}>Photograph a cookbook page — Claude will extract and translate the full recipe automatically.</p>

            {!previewImage && (
              <div
                className="drop-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("active"); }}
                onDragLeave={e => e.currentTarget.classList.remove("active")}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("active"); handleImageUpload(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Drop a photo here</p>
                <p style={{ color: "#9a8060", fontSize: 15 }}>or click to choose from your files</p>
                <p style={{ color: "#b8a888", fontSize: 13, marginTop: 12 }}>JPG, PNG, HEIC — works with any cookbook page</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e.target.files[0])} />
              </div>
            )}

            {previewImage && (
              <div style={{ display: "grid", gridTemplateColumns: extractedRecipe ? "1fr 1fr" : "1fr", gap: 24 }}>
                <div>
                  <img src={previewImage} alt="Cookbook page" style={{ width: "100%", borderRadius: 8, border: "1px solid #e8ddc8" }} />
                  <button className="btn-ghost" style={{ marginTop: 12, width: "100%" }} onClick={() => { setPreviewImage(null); setExtractedRecipe(null); setError(null); setViewLang("en"); fileRef.current?.click(); }}>
                    Try different photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e.target.files[0])} />
                </div>

                <div>
                  {(extracting || translating || generatingImage) && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "#9a8060" }}>
                      <div className="spinner" />
                      <p style={{ fontSize: 16, fontStyle: "italic" }}>
                        {extracting ? "Reading your recipe…" : translating ? "Translating to German & French…" : "Generating recipe image…"}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div style={{ background: "#fdf0e8", border: "1px solid #e8c4a0", borderRadius: 8, padding: 20 }}>
                      <p style={{ color: "#8f4a1e", fontWeight: 600, marginBottom: 8 }}>Extraction failed</p>
                      <p style={{ color: "#7a4030", fontSize: 15 }}>{error}</p>
                    </div>
                  )}

                  {extractedRecipe && !extracting && !translating && !generatingImage && (
                    <div className="fade-in" style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 8, padding: 20 }}>
                      <LangTabs hasTranslations={extractedRecipe.translations && Object.keys(extractedRecipe.translations).length > 0} />
                      {(() => {
                        const r = getRecipeInLang(extractedRecipe, viewLang);
                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22 }}>{r.title}</h3>
                              {r.thermomixAdapted && <span style={{ fontSize: 20 }}>🌀</span>}
                            </div>
                            <p style={{ color: "#7a6040", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>{r.description}</p>
                            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#9a8060", marginBottom: 12 }}>
                              {r.servings && <span>👥 {r.servings} servings</span>}
                              {r.prepTime && <span>⏱ {r.prepTime}min</span>}
                              {r.cookTime && <span>🔥 {r.cookTime}min</span>}
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontWeight: 600, fontSize: 13, color: "#5a4020", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ingredients</p>
                              <ul style={{ listStyle: "none", fontSize: 14 }}>
                                {r.ingredients?.slice(0, 5).map((ing, i) => (
                                  <li key={i} style={{ padding: "3px 0", borderBottom: "1px solid #f0ebe0", color: "#4a3820" }}>
                                    <span style={{ fontWeight: 600 }}>{ing.amount} {ing.unit}</span> {ing.name}
                                  </li>
                                ))}
                                {r.ingredients?.length > 5 && <li style={{ color: "#9a8060", fontSize: 13, paddingTop: 4 }}>+{r.ingredients.length - 5} more…</li>}
                              </ul>
                            </div>
                          </>
                        );
                      })()}
                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button className="btn-primary" onClick={saveRecipe} style={{ flex: 1 }}>Save to Library</button>
                        <button className="btn-ghost" onClick={() => exportCookidoo(getRecipeInLang(extractedRecipe, viewLang))} style={{ flex: 1 }}>Export for Cookidoo</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!previewImage && (
              <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { icon: "📸", title: "Photograph", text: "Take a clear photo of any cookbook page" },
                  { icon: "🤖", title: "AI Extracts", text: "Claude reads and structures the full recipe" },
                  { icon: "🌐", title: "3 Languages", text: "Auto-translated into English, German & French" },
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
                  <div style={{ height: 300, overflow: "hidden" }}>
                    <img src={selectedRecipe.generatedImageUrl || r.imageUrl} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ padding: "28px 32px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, lineHeight: 1.2 }}>{r.title}</h1>
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 32 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Ingredients</h3>
                      <ul style={{ listStyle: "none" }}>
                        {r.ingredients?.map((ing, i) => (
                          <li key={i} style={{ padding: "7px 0", borderBottom: "1px solid #f5f0e8", fontSize: 15, display: "flex", gap: 8 }}>
                            <span style={{ fontWeight: 600, minWidth: 80, color: "#b5622a" }}>{ing.amount} {ing.unit}</span>
                            <span>{ing.name}{ing.note && <em style={{ color: "#9a8060", fontSize: 13 }}>, {ing.note}</em>}</span>
                          </li>
                        ))}
                      </ul>
                      {r.equipment?.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 10 }}>Equipment</h3>
                          <ul style={{ listStyle: "none" }}>
                            {r.equipment.map((item, i) => (
                              <li key={i} style={{ padding: "5px 0", borderBottom: "1px solid #f5f0e8", fontSize: 14, color: "#5a4020", display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ color: "#b5622a", fontSize: 16 }}>🍳</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Method</h3>
                      <ol style={{ listStyle: "none" }}>
                        {r.steps?.map((step, i) => (
                          <li key={i} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                            <span style={{ background: "#b5622a", color: "#faf7f2", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{step.step || i + 1}</span>
                            <div>
                              <p style={{ fontSize: 15, lineHeight: 1.6 }}>{step.instruction}</p>
                              {(step.duration || step.temp) && (
                                <p style={{ fontSize: 13, color: "#9a8060", marginTop: 4 }}>
                                  {step.duration && `⏱ ${step.duration}min`} {step.temp && `🌡 ${step.temp}°C`}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {r.notes && (
                        <div style={{ background: "#fdf9f0", border: "1px solid #e8ddc8", borderRadius: 6, padding: 14, marginTop: 16 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#b5622a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Chef's Notes</p>
                          <p style={{ fontSize: 14, color: "#5a4020", lineHeight: 1.6 }}>{r.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: "1px solid #f0ebe0" }}>
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
    </div>
  );
}
