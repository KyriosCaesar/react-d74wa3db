import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRecipes } from "../hooks/useRecipes";
import RecipeLoadingScreen from "../components/digitize/RecipeLoadingScreen";
import {
  extractRecipes,
  translateRecipe,
  generateRecipeImage,
  generateContextualExtractionMessages,
  generateContextualTranslationMessages,
} from "../services/api";
import { EXTRACTION_MESSAGES, TRANSLATION_MESSAGES } from "../constants";

export default function DigitizePage() {
  const { user, userRef } = useAuth();
  const { saveRecipe, addRecipes } = useRecipes(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef();

  const [extracting, setExtracting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [error, setError] = useState(null);
  const [contextualMessages, setContextualMessages] = useState(null);

  const isProcessing = extracting || translating || generatingImage;

  // Handle files passed via navigation state (from EmptyStateHero)
  useEffect(() => {
    if (location.state?.files) {
      handleImagesUpload(location.state.files);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImagesUpload = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type.startsWith("image/"));
    if (files.length === 0) return;

    setError(null);
    setContextualMessages(null);

    const fileData = await Promise.all(
      files.map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve({
          base64: e.target.result.split(",")[1],
          dataUrl: e.target.result,
          mediaType: file.type,
        });
        reader.readAsDataURL(file);
      }))
    );

    setPreviewImages(fileData.map(f => f.dataUrl));
    setExtracting(true);

    // Generate witty loading messages in parallel (haiku is fast)
    generateContextualExtractionMessages(fileData)
      .then(msgs => { if (Array.isArray(msgs)) setContextualMessages(msgs); })
      .catch(() => {});

    try {
      const result = await extractRecipes(fileData);
      const recipesArray = Array.isArray(result) ? result : [result];

      const now = Date.now();
      const newRecipes = recipesArray.map((parsed, idx) => ({
        ...parsed,
        id: now + idx,
        addedAt: new Date().toISOString(),
        imageUrl: fileData[0].dataUrl,
      }));

      setExtracting(false);
      setContextualMessages(null);
      setTranslating(true);
      setGeneratingImage(true);

      generateContextualTranslationMessages(newRecipes)
        .then(msgs => { if (Array.isArray(msgs)) setContextualMessages(msgs); })
        .catch(() => {});

      // Translate + generate image for all recipes in parallel
      await Promise.all(newRecipes.map(async (recipe) => {
        const [deResult, frResult, imageResult] = await Promise.allSettled([
          translateRecipe(recipe, "de"),
          translateRecipe(recipe, "fr"),
          generateRecipeImage(recipe),
        ]);
        recipe.translations = {};
        if (deResult.status === "fulfilled") recipe.translations.de = deResult.value;
        if (frResult.status === "fulfilled") recipe.translations.fr = frResult.value;
        if (imageResult.status === "fulfilled" && imageResult.value) recipe.generatedImageUrl = imageResult.value;
      }));

      // Update TanStack Query cache immediately
      addRecipes(newRecipes);

      // Persist to Supabase
      if (userRef.current) {
        newRecipes.forEach(r => saveRecipe(r));
      }

      setPreviewImages([]);

      if (newRecipes.length === 1) {
        navigate(`/recipe/${newRecipes[0].id}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Extraction failed. Please try again.");
    } finally {
      setExtracting(false);
      setTranslating(false);
      setGeneratingImage(false);
    }
  };

  const resetUpload = () => {
    setPreviewImages([]);
    setError(null);
    setContextualMessages(null);
    fileRef.current?.click();
  };

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      {!isProcessing && (
        <>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 6 }}>Digitize a Recipe</h2>
          <p style={{ color: "#7a6040", marginBottom: 28, fontSize: 16 }}>
            Photograph one or more cookbook pages — Claude will detect how many recipes are present and extract them all automatically.
          </p>
        </>
      )}

      {/* Drop zone — shown when no images selected */}
      {previewImages.length === 0 && (
        <div
          className="drop-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("active"); }}
          onDragLeave={e => e.currentTarget.classList.remove("active")}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("active"); handleImagesUpload(e.dataTransfer.files); }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Drop photos here</p>
          <p style={{ color: "#9a8060", fontSize: 15 }}>or click to choose — select multiple to scan several recipes at once</p>
          <p style={{ color: "#b8a888", fontSize: 13, marginTop: 12 }}>JPG, PNG, HEIC — works with any cookbook page</p>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImagesUpload(e.target.files)} />
        </div>
      )}

      {/* Preview + processing */}
      {previewImages.length > 0 && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImagesUpload(e.target.files)} />

          {!isProcessing && (
            previewImages.length === 1 ? (
              <img src={previewImages[0]} alt="Cookbook page" style={{ width: "100%", borderRadius: 8, border: "1px solid #e8ddc8" }} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {previewImages.map((src, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={src} alt={`Page ${i + 1}`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: "1px solid #e8ddc8", display: "block" }} />
                    <span style={{ position: "absolute", bottom: 6, right: 6, background: "#2c2416cc", color: "#faf7f2", fontSize: 11, padding: "2px 6px", borderRadius: 4 }}>{i + 1}</span>
                  </div>
                ))}
              </div>
            )
          )}

          <RecipeLoadingScreen
            extracting={extracting}
            translating={translating}
            generatingImage={generatingImage}
            messages={extracting
              ? (contextualMessages ?? EXTRACTION_MESSAGES)
              : (contextualMessages ?? TRANSLATION_MESSAGES)}
          />

          {error && (
            <div style={{ background: "#fdf0e8", border: "1px solid #e8c4a0", borderRadius: 8, padding: 20, marginTop: 16 }}>
              <p style={{ color: "#8f4a1e", fontWeight: 600, marginBottom: 8 }}>Extraction failed</p>
              <p style={{ color: "#7a4030", fontSize: 15 }}>{error}</p>
            </div>
          )}

          {!isProcessing && (
            <button className="btn-ghost" style={{ marginTop: 12, width: "100%" }} onClick={resetUpload}>
              Try different photo{previewImages.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Info cards */}
      {previewImages.length === 0 && (
        <div className="info-grid" style={{ marginTop: 40, display: "grid", gap: 16 }}>
          {[
            { icon: "📸", title: "Photograph", text: "Take one or more photos of any cookbook page" },
            { icon: "🤖", title: "AI Extracts", text: "Claude reads all images and detects each distinct recipe automatically" },
            { icon: "🌐", title: "3 Languages", text: "Every recipe is auto-translated into English, German & French" },
          ].map(step => (
            <div key={step.title} style={{ background: "#fff", border: "1px solid #e8ddc8", borderRadius: 8, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, marginBottom: 6 }}>{step.title}</p>
              <p style={{ fontSize: 14, color: "#9a8060", lineHeight: 1.5 }}>{step.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
