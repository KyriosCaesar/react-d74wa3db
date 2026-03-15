import React from "react";
import { useNavigate } from "react-router-dom";

export default function RecipeCard({ recipe }) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      onClick={() => navigate(`/recipe/${recipe.id}`)}
      style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
    >
      {(recipe.generatedImageUrl || recipe.imageUrl) && (
        <div style={{ height: 160, overflow: "hidden", background: "#e8ddc8" }}>
          <img
            src={recipe.generatedImageUrl || recipe.imageUrl}
            alt={recipe.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
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
        <p style={{ fontSize: 14, color: "#7a6040", lineHeight: 1.5, marginBottom: 10 }}>
          {recipe.description?.substring(0, 80)}{recipe.description?.length > 80 ? "…" : ""}
        </p>
        <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#9a8060", marginBottom: 10 }}>
          {recipe.prepTime && <span>⏱ {recipe.prepTime}min prep</span>}
          {recipe.cookTime && <span>🔥 {recipe.cookTime}min cook</span>}
          {recipe.servings && <span>👥 {recipe.servings}</span>}
        </div>
        <div>{recipe.tags?.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}</div>
      </div>
    </div>
  );
}
