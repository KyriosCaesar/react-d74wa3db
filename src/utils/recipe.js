// Returns the recipe translated into the given language, falling back to English.
export const getRecipeInLang = (recipe, lang) => {
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

// Renders **bold** markdown as <strong> elements.
export const renderBold = (text) => {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "#3a2810" }}>{part}</strong>
      : part
  );
};

// Returns ingredients + equipment items mentioned in a step's instruction text.
export const getMentionedItems = (step, recipe) => {
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

// Canvas-based background removal: samples the 4 corner pixels to detect the
// actual background colour, then fades out pixels close to that background.
export const removeBackground = (dataUrl) =>
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

      const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const corners = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)];
      const bg = corners.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]).map(v => v / 4);

      const T = 40, F = 25;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2);
        if (dist < T + F) {
          d[i + 3] = dist < T ? 0 : Math.round(((dist - T) / F) * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

export const exportCookidoo = (recipe) => {
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
};
