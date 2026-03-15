import React from "react";
import { IngredientThumb, EquipmentThumb } from "../ItemThumb";

export default function IngredientList({ ingredients, equipment }) {
  return (
    <div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Ingredients</h3>
      <ul style={{ listStyle: "none" }}>
        {ingredients?.map((ing, i) => (
          <li key={i} style={{ padding: "7px 0", borderBottom: "1px solid #f5f0e8", fontSize: 15, display: "flex", gap: 10, alignItems: "center" }}>
            <IngredientThumb name={ing.name} amount={ing.amount} unit={ing.unit} delay={i * 300} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: "#b5622a" }}>{ing.amount} {ing.unit}</span>
              <span> {ing.name}{ing.note && <em style={{ color: "#9a8060", fontSize: 13 }}>, {ing.note}</em>}</span>
            </div>
          </li>
        ))}
      </ul>

      {equipment?.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 10 }}>Equipment</h3>
          <ul style={{ listStyle: "none" }}>
            {equipment.map((item, i) => (
              <li key={i} style={{ padding: "5px 0", borderBottom: "1px solid #f5f0e8", fontSize: 14, color: "#5a4020", display: "flex", gap: 8, alignItems: "center" }}>
                <EquipmentThumb name={item} delay={i * 200} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
