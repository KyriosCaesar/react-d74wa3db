import React, { useState, useEffect, useCallback } from "react";
import { removeBackground } from "../utils/recipe";
import {
  fetchCachedImage,
  storeCachedImage,
} from "../services/supabase";
import {
  generateIngredientImagePrompt,
  generateRawGeminiImage,
} from "../services/api";

// Generic thumbnail: fetches via fetchFn, strips background, shows a spinner.
export function ItemThumb({ name, fetchFn, amount, unit, size = 44, spinnerSize = 16, delay = 0 }) {
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
}

// Generates + caches an ingredient image.
const fetchIngredientImage = async (name, amount, unit) => {
  // Key is ingredient name only — same ingredient looks the same regardless of amount
  const key = `ing:${name.toLowerCase().trim()}`;

  const cached = await fetchCachedImage(key);
  if (cached) return cached;

  const prompt = generateIngredientImagePrompt(name, amount, unit);
  const url = await generateRawGeminiImage(prompt);
  if (url) await storeCachedImage(key, url);
  return url;
};

// Generates + caches an equipment image.
const fetchEquipmentImage = async (name) => {
  const key = `eq:${name.toLowerCase().trim()}`;
  const cached = await fetchCachedImage(key);
  if (cached) return cached;

  const prompt = `Minimalist, clean product photograph of a ${name} kitchen tool on a pure white background. Single item only, no text, no labels, soft studio lighting, cookbook style.`;
  const url = await generateRawGeminiImage(prompt);
  if (url) await storeCachedImage(key, url);
  return url;
};

export const IngredientThumb = ({ name, amount, unit, englishName, size = 72, delay = 0 }) => {
  // Use the English ingredient name for the cache key so DE/FR thumbnails
  // hit the same cache entry as the English version.
  const cacheName = englishName ?? name;
  const fetchFn = useCallback(
    (_n, a, u) => fetchIngredientImage(cacheName, a, u),
    [cacheName]
  );
  return (
    <ItemThumb name={name} amount={amount} unit={unit} fetchFn={fetchFn}
      size={size} spinnerSize={Math.round(size * 0.28)} delay={delay} />
  );
};

export const EquipmentThumb = ({ name, size = 60, delay = 0 }) =>
  <ItemThumb name={name} fetchFn={fetchEquipmentImage}
    size={size} spinnerSize={Math.round(size * 0.3)} delay={delay} />;
