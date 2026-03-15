import React, { useState, useEffect } from "react";
import { getMentionedItems, renderBold } from "../../utils/recipe";
import { IngredientThumb, EquipmentThumb } from "../ItemThumb";

export default function CookModeOverlay({ recipe, onClose }) {
  const [cookStep, setCookStep] = useState(-1); // -1=intro, 0..N-1=steps, N=done

  const steps = recipe.steps || [];
  const totalSteps = steps.length;
  const isIntro = cookStep === -1;
  const isDone = cookStep >= totalSteps;
  const step = (!isIntro && !isDone) ? steps[cookStep] : null;
  const progress = isIntro ? 0 : isDone ? 100 : Math.round(((cookStep + 1) / totalSteps) * 100);
  const items = step ? getMentionedItems(step, recipe) : [];

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCookStep(s => Math.min(s + 1, totalSteps));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCookStep(s => Math.max(s - 1, -1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalSteps, onClose]);

  const goNext = () => { if (isDone) onClose(); else setCookStep(s => s + 1); };
  const goPrev = () => setCookStep(s => Math.max(s - 1, -1));

  const handleBodyClick = (e) => {
    const pct = e.clientX / window.innerWidth;
    if (pct < 0.3 && !isIntro) goPrev();
    else goNext();
  };

  return (
    <div className="cook-overlay">
      {/* Progress bar */}
      <div style={{ height: 3, background: "#1a0e06", width: "100%", flexShrink: 0 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#b5622a", transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
      </div>

      {/* Header */}
      <div className="cook-header">
        <div>
          <p style={{ fontFamily: "'Playfair Display', serif", color: "#c8916a", fontSize: 13, letterSpacing: "0.8px", textTransform: "uppercase", margin: 0 }}>{recipe.title}</p>
          <p style={{ color: "#5a4020", fontSize: 12, margin: "2px 0 0" }}>
            {isIntro ? "Prepare your mise en place" : isDone ? "Complete!" : `Step ${cookStep + 1} of ${totalSteps}`}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ background: "none", border: "1px solid #2c2010", color: "#5a4020", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", letterSpacing: "0.03em" }}
        >
          ✕ Exit
        </button>
      </div>

      {/* Body */}
      <div className="cook-body cook-step-enter" onClick={handleBodyClick}>
        {isIntro && (
          <>
            <p style={{ color: "#5a4020", fontSize: 13, marginBottom: 32, fontFamily: "'Inter', sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Before you begin</p>
            <p className="cook-instruction">{recipe.title}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 32, maxWidth: 680 }}>
              {recipe.ingredients?.slice(0, 8).map((ing, i) => (
                <div key={i} className="cook-chip">
                  <IngredientThumb name={ing.name} amount={ing.amount} unit={ing.unit} size={26} delay={i * 60} />
                  <span>{ing.amount} {ing.unit} {ing.name}</span>
                </div>
              ))}
            </div>
            <p style={{ color: "#3a2010", fontSize: 13, marginTop: 40, fontFamily: "'Inter', sans-serif" }}>Tap anywhere to start cooking →</p>
          </>
        )}

        {!isIntro && !isDone && step && (
          <>
            {(step.duration || step.temp) && (
              <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
                {step.duration && (
                  <div style={{ background: "#1a0e06", border: "1px solid #3a2418", borderRadius: 8, padding: "6px 16px", fontSize: 13, color: "#c8916a", fontFamily: "'Inter', sans-serif" }}>
                    ⏱ {step.duration} min
                  </div>
                )}
                {step.temp && (
                  <div style={{ background: "#1a0e06", border: "1px solid #3a2418", borderRadius: 8, padding: "6px 16px", fontSize: 13, color: "#c8916a", fontFamily: "'Inter', sans-serif" }}>
                    🌡 {step.temp}°C
                  </div>
                )}
              </div>
            )}
            <p className="cook-instruction">{renderBold(step.instruction)}</p>
            {items.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 28 }}>
                {items.map((item, j) => (
                  <div key={j} className="cook-chip">
                    {item.type === "ingredient"
                      ? <IngredientThumb name={item.name} amount={item.amount} unit={item.unit} size={26} delay={j * 60} />
                      : <EquipmentThumb name={item.name} size={26} delay={j * 60} />
                    }
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            )}
            {!isIntro && <span className="cook-arrow" style={{ right: 24 }}>›</span>}
            {cookStep > 0 && <span className="cook-arrow" style={{ left: 24 }}>‹</span>}
          </>
        )}

        {isDone && (
          <>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🍽️</div>
            <p className="cook-instruction">Enjoy your {recipe.title}!</p>
            <p style={{ color: "#5a4020", fontSize: 15, marginTop: 24, fontFamily: "'Inter', sans-serif" }}>Tap to finish</p>
          </>
        )}
      </div>

      {/* Step dots */}
      {!isIntro && !isDone && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "16px 24px", flexShrink: 0 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); setCookStep(i); }}
              style={{ width: i === cookStep ? 20 : 6, height: 6, borderRadius: 3, background: i === cookStep ? "#b5622a" : "#2c2010", transition: "all 0.3s", cursor: "pointer" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
