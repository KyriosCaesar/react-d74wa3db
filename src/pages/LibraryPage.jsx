import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRecipes } from "../hooks/useRecipes";
import RecipeGrid from "../components/library/RecipeGrid";
import EmptyStateHero from "../components/library/EmptyStateHero";

export default function LibraryPage() {
  const { user } = useAuth();
  const { recipes, isLoading } = useRecipes(user?.id);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Logged in but no recipes
  if (user && recipes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", padding: "0 24px" }}>
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ marginBottom: 20, opacity: 0.35 }}>
          <rect x="8" y="10" width="26" height="36" rx="3" stroke="#7a6040" strokeWidth="2.5"/>
          <rect x="14" y="10" width="26" height="36" rx="3" stroke="#7a6040" strokeWidth="2.5" fill="#f4ede0"/>
          <path d="M20 22h14M20 28h10" stroke="#b8a888" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#2c2416", marginBottom: 10 }}>Your library is empty</h2>
        <p style={{ color: "#9a8060", fontSize: 15, maxWidth: 340, lineHeight: 1.6, marginBottom: 28 }}>
          Photograph a recipe page and Claude will digitize it into your personal cookbook.
        </p>
        <button className="btn-primary" onClick={() => navigate("/digitize")} style={{ padding: "12px 28px", fontSize: 15 }}>
          Digitize your first recipe
        </button>
      </div>
    );
  }

  // Not logged in — show the hero + upload CTA
  if (!user) {
    return (
      <EmptyStateHero
        onFiles={(files) => navigate("/digitize", { state: { files } })}
      />
    );
  }

  // Has recipes
  return (
    <div className="fade-in">
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
