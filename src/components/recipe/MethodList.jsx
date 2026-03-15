import React from "react";
import { renderBold, getMentionedItems } from "../../utils/recipe";
import { IngredientThumb, EquipmentThumb } from "../ItemThumb";

export default function MethodList({ steps, recipe, notes }) {
  return (
    <div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 14 }}>Method</h3>
      <ol style={{ listStyle: "none" }}>
        {steps?.map((step, i) => {
          const mentionedItems = getMentionedItems(step, recipe);
          return (
            <li key={i} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <span style={{ background: "#b5622a", color: "#faf7f2", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                {step.step || i + 1}
              </span>
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

      {notes && (
        <div style={{ background: "#fdf9f0", border: "1px solid #e8ddc8", borderRadius: 6, padding: 14, marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#b5622a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Chef's Notes</p>
          <p style={{ fontSize: 14, color: "#5a4020", lineHeight: 1.6 }}>{notes}</p>
        </div>
      )}
    </div>
  );
}
