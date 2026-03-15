import React, { useState } from "react";
import RecipeCard from "./RecipeCard";

export default function RecipeGrid({ recipes }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", ...new Set(recipes.map(r => r.category).filter(Boolean))];

  const filtered = recipes.filter(r => {
    const matchesSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <>
      <div className="library-top" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          className="input"
          placeholder="Search recipes, ingredients, tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                borderColor: activeCategory === cat ? "#b5622a" : "#d4c5a9",
                background: activeCategory === cat ? "#b5622a" : "transparent",
                color: activeCategory === cat ? "#faf7f2" : "#7a6040",
                cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", transition: "all 0.2s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {filtered.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </>
  );
}
