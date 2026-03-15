import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storageKey: "cookable-auth", lock: (_name, _timeout, fn) => fn() } }
);

// ── Recipe CRUD ───────────────────────────────────────────────────────────────

export const saveRecipeToSupabase = async (recipe, userId) => {
  const { data, error } = await supabase
    .from("recipes")
    .upsert({ id: String(recipe.id), user_id: userId, data: recipe }, { onConflict: "id" })
    .select();
  if (error) console.error("SUPABASE SAVE ERROR:", error.message, error.details, error.hint);
  return data;
};

export const loadRecipesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from("recipes")
    .select("data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("Failed to load recipes:", error); return []; }
  return data?.map(r => r.data) ?? [];
};

export const deleteRecipeFromSupabase = async (id) => {
  const { error } = await supabase.from("recipes").delete().eq("id", String(id));
  if (error) console.error("Failed to delete recipe:", error);
};

// ── Ingredient/Equipment image cache ─────────────────────────────────────────

export const fetchCachedImage = async (cacheKey) => {
  const { data } = await supabase
    .from("ingredient_images")
    .select("image_data")
    .eq("name", cacheKey)
    .maybeSingle();
  return data?.image_data ?? null;
};

export const storeCachedImage = async (cacheKey, url) => {
  await supabase
    .from("ingredient_images")
    .upsert({ name: cacheKey, image_data: url }, { onConflict: "name" });
};
