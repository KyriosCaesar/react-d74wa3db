import React from "react";
import { LANGUAGES } from "../../constants";

export default function LangTabs({ viewLang, setViewLang, hasTranslations, translating }) {
  return (
    <div className="lang-tabs-row">
      {LANGUAGES.map(l => {
        const available = l.code === "en" || hasTranslations;
        return (
          <button
            key={l.code}
            onClick={() => available && setViewLang(l.code)}
            style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: "1.5px solid",
              borderColor: viewLang === l.code ? "#b5622a" : "#d4c5a9",
              background: viewLang === l.code ? "#b5622a" : "transparent",
              color: viewLang === l.code ? "#faf7f2" : available ? "#7a6040" : "#c8bba8",
              cursor: available ? "pointer" : "not-allowed",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: viewLang === l.code ? 600 : 400,
              transition: "all 0.2s",
            }}
            title={!available ? "Translations not yet available" : undefined}
          >
            {l.flag} {l.label}
          </button>
        );
      })}
      {translating && (
        <span style={{ alignSelf: "center", marginLeft: 8, fontSize: 13, color: "#9a8060", fontStyle: "italic" }}>
          Translating…
        </span>
      )}
    </div>
  );
}
