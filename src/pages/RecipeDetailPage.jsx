import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRecipes } from "../hooks/useRecipes";
import { getRecipeInLang, exportCookidoo } from "../utils/recipe";
import LangTabs from "../components/recipe/LangTabs";
import IngredientList from "../components/recipe/IngredientList";
import MethodList from "../components/recipe/MethodList";
import CookModeOverlay from "../components/recipe/CookModeOverlay";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recipes, deleteRecipe } = useRecipes(user?.id);

  const [viewLang, setViewLang] = useState("en");
  const [cookMode, setCookMode] = useState(false);
  const [exportedDone, setExportedDone] = useState(false);

  // Look up recipe from TanStack Query cache
  const recipe = recipes.find(r => String(r.id) === id);

  if (!recipe) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px", color: "#9a8060" }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Recipe not found.</p>
        <button className="btn-ghost" onClick={() => navigate("/")}>← Back to library</button>
      </div>
    );
  }

  const r = getRecipeInLang(recipe, viewLang);

  const handleDelete = () => {
    deleteRecipe(recipe.id);
    navigate("/");
  };

  const handleExport = () => {
    exportCookidoo(r);
    setExportedDone(true);
    setTimeout(() => setExportedDone(false), 3000);
  };

  return (
    <>
      <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8060", fontSize: 15, marginBottom: 20, padding: 0 }}>
          ← Back to library
        </button>

        <LangTabs
          viewLang={viewLang}
          setViewLang={setViewLang}
          hasTranslations={recipe.translations && Object.keys(recipe.translations).length > 0}
          translating={false}
        />

        <div style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 12, overflow: "hidden" }}>
          {(recipe.generatedImageUrl || r.imageUrl) && (
            <div className="detail-img">
              <img src={recipe.generatedImageUrl || r.imageUrl} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}

          <div className="detail-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
              <h1 className="detail-title">{r.title}</h1>
              {r.thermomixAdapted && <span style={{ fontSize: 24 }} title="Thermomix adapted">🌀</span>}
            </div>
            {r.source && <p style={{ color: "#9a8060", fontSize: 14, marginBottom: 12, fontStyle: "italic" }}>From: {r.source}</p>}
            <p style={{ fontSize: 17, color: "#5a4020", lineHeight: 1.6, marginBottom: 20 }}>{r.description}</p>

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 15, color: "#7a6040", padding: "16px 0", borderTop: "1px solid #f0ebe0", borderBottom: "1px solid #f0ebe0", marginBottom: r.nutrition ? 12 : 24, alignItems: "center" }}>
              {r.servings && <span>👥 {r.servings} servings</span>}
              {r.prepTime && <span>⏱ {r.prepTime}min prep</span>}
              {r.cookTime && <span>🔥 {r.cookTime}min cook</span>}
              {r.category && <span>🏷 {r.category}</span>}
              {r.difficulty && (
                <span style={{
                  background: r.difficulty === "Easy" ? "#e8f5e9" : r.difficulty === "Medium" ? "#fff8e1" : "#fdecea",
                  color: r.difficulty === "Easy" ? "#2e7d32" : r.difficulty === "Medium" ? "#f57f17" : "#c62828",
                  borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 600,
                }}>
                  {r.difficulty === "Easy" ? "🟢" : r.difficulty === "Medium" ? "🟡" : "🔴"} {r.difficulty}
                </span>
              )}
            </div>

            {/* Nutrition */}
            {r.nutrition && (
              <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Calories", value: r.nutrition.calories, unit: "kcal", color: "#b5622a" },
                  { label: "Protein", value: r.nutrition.protein, unit: "g", color: "#4a7c59" },
                  { label: "Fat", value: r.nutrition.fat, unit: "g", color: "#7a6040" },
                  { label: "Carbs", value: r.nutrition.carbs, unit: "g", color: "#5a6080" },
                ].map(n => n.value != null && (
                  <div key={n.label} style={{ background: "#faf7f2", border: "1px solid #e8ddc8", borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 70 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: n.color }}>{n.value}<span style={{ fontSize: 11, fontWeight: 400 }}>{n.unit}</span></div>
                    <div style={{ fontSize: 11, color: "#9a8060", textTransform: "uppercase", letterSpacing: "0.4px" }}>{n.label}</div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "#b8a888", alignSelf: "flex-end", paddingBottom: 4 }}>per serving · estimated</div>
              </div>
            )}

            {/* Ingredients + Method */}
            <div className="detail-grid">
              <IngredientList ingredients={r.ingredients} equipment={r.equipment} />
              <MethodList steps={r.steps} recipe={r} notes={r.notes} />
            </div>

            {/* Action row */}
            <div className="action-row">
              <button
                className="btn-primary"
                style={{ flex: 1, background: "#4a7c59", fontSize: 17 }}
                onClick={() => setCookMode(true)}
              >
                👨‍🍳 Start Cooking
              </button>
              <button className="btn-primary" onClick={handleExport} style={{ flex: 1 }}>
                {exportedDone ? "✓ Downloaded!" : "🌀 Export for Cookidoo"}
              </button>
              <button className="btn-ghost" onClick={handleDelete} style={{ color: "#c0503a", borderColor: "#c0503a55" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cook mode overlay */}
      {cookMode && (
        <CookModeOverlay recipe={r} onClose={() => setCookMode(false)} />
      )}
    </>
  );
}
