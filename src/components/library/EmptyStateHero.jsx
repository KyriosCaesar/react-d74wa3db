import React, { useState, useRef, useMemo, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { BOOK_IMAGES } from "../../constants";

function BookCover({ src }) {
  return (
    <img
      src={src}
      alt="Cookbook"
      style={{
        height: 300,
        width: "auto",
        display: "block",
        filter: "drop-shadow(0px 40px 80px rgba(0,0,0,0.18)) drop-shadow(0px 12px 32px rgba(0,0,0,0.09))",
      }}
    />
  );
}

export default function EmptyStateHero({ onFiles }) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [scattered, setScattered] = useState(false);
  const [isMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 640);

  const { scrollYProgress: sp } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  const selectedImages = useMemo(() => {
    const shuffled = [...BOOK_IMAGES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);

  const b0x = useTransform(sp, [0, 1], [0, -290]); const b0y = useTransform(sp, [0, 1], [0, 90]); const b0r = useTransform(sp, [0, 1], [-3, -20]);
  const b1x = useTransform(sp, [0, 1], [0, 0]);    const b1y = useTransform(sp, [0, 1], [0, -70]); const b1r = useTransform(sp, [0, 1], [-1, -2]);
  const b2x = useTransform(sp, [0, 1], [0, 290]);  const b2y = useTransform(sp, [0, 1], [0, 90]);  const b2r = useTransform(sp, [0, 1], [2, 20]);

  const hlOp  = useTransform(sp, [0, 0.5], [1, 0.65]);
  const hlY   = useTransform(sp, [0, 0.5], [0, -18]);
  const scOp  = useTransform(sp, [0, 0.2], [1, 0]);
  const fadeOp = useTransform(sp, [0, 0.35], [0, 1]);

  useEffect(() => {
    if (!isMobile) return;
    const t = setTimeout(() => setScattered(true), 900);
    return () => clearTimeout(t);
  }, [isMobile]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  const TR = { duration: 0.9, ease: [0.22, 0.68, 0, 1.2] };

  const bookDefs = [
    { ds: { x: b0x, y: b0y, rotate: b0r }, mob: { x: -120, y: 70, r: -18 }, ir: -3, z: 2, floatDur: 3.8, floatDelay: 0 },
    { ds: { x: b1x, y: b1y, rotate: b1r }, mob: { x: 0, y: -70, r: -1 }, ir: -0.5, z: 8, floatDur: 4.4, floatDelay: 0.7 },
    { ds: { x: b2x, y: b2y, rotate: b2r }, mob: { x: 120, y: 70, r: 18 }, ir: 2, z: 2, floatDur: 3.2, floatDelay: 1.4 },
  ];

  return (
    <>
      <div
        ref={containerRef}
        style={{
          height: isMobile ? "100svh" : "130vh",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginTop: 0,
          position: "relative",
          background: "linear-gradient(to bottom, #FDFBF1 0%, #2D241E 100%)",
        }}
      >
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "rgba(244,197,66,0.13)", filter: "blur(150px)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{
          position: isMobile ? "relative" : "sticky",
          top: 0,
          height: isMobile ? "100svh" : "100vh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isMobile ? "center" : "flex-start",
          paddingTop: isMobile ? 0 : "10vh",
          overflow: "visible",
        }}>
          <motion.div
            style={isMobile
              ? { textAlign: "center", padding: "0 24px", marginBottom: 48, position: "relative", zIndex: 2 }
              : { opacity: hlOp, y: hlY, textAlign: "center", padding: "0 24px", marginBottom: 64, position: "relative", zIndex: 2 }}
            {...(isMobile ? {
              animate: { opacity: scattered ? 0.7 : 1, y: scattered ? -16 : 0 },
              transition: TR,
            } : {})}
          >
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 500, letterSpacing: "-0.025em", color: "#2c2416", lineHeight: 1.15, maxWidth: 540, margin: "0 auto" }}>
              What will you cook<br />from your shelf today?
            </h2>
            {isMobile && !scattered && (
              <p style={{ color: "#b8a888", fontSize: 14, marginTop: 14, fontStyle: "italic" }}>Opening your cookbooks…</p>
            )}
          </motion.div>

          <div style={{ position: "relative", width: "100%", height: 400, zIndex: 2 }}>
            <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 420, height: 44, background: "radial-gradient(ellipse at center, rgba(44,36,22,0.18) 0%, transparent 72%)", pointerEvents: "none", zIndex: 0 }} />
            {bookDefs.map((bd, i) => (
              <motion.div
                key={i}
                style={{ position: "absolute", left: "50%", top: "50%", zIndex: bd.z, ...(isMobile ? {} : bd.ds) }}
                {...(isMobile ? {
                  initial: { x: 0, y: 0, rotate: bd.ir },
                  animate: scattered ? { x: bd.mob.x, y: bd.mob.y, rotate: bd.mob.r } : { x: 0, y: 0, rotate: bd.ir },
                  transition: { ...TR, delay: i * 0.05 },
                } : {})}
              >
                <div style={{ transform: "translate(-50%, -50%)" }}>
                  <div style={{ animation: `bookFloat ${bd.floatDur}s ease-in-out ${bd.floatDelay}s infinite` }}>
                    <BookCover src={selectedImages[i]} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {!isMobile && (
            <motion.div style={{ position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)", opacity: scOp, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a8060" }}>Scroll to explore</span>
              <div style={{ animation: "scrollBounce 1.6s ease-in-out infinite" }}>
                <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                  <path d="M1 1.5L8 8.5L15 1.5" stroke="#b8a888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>
          )}

          <motion.div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 220, background: "linear-gradient(to bottom, transparent 0%, #2D241E 100%)", pointerEvents: "none", zIndex: 10, opacity: fadeOp }} />
        </div>
      </div>

      {/* Upload section */}
      <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", padding: isMobile ? "48px 24px 72px" : "80px 24px 110px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "visible", background: "#2D241E" }}>
        <div style={{ position: "absolute", top: "30%", left: "62%", transform: "translate(-50%, -50%)", width: 560, height: 560, borderRadius: "50%", background: "rgba(226,232,213,0.22)", filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 680, height: 680, borderRadius: "50%", background: "rgba(244,197,66,0.14)", filter: "blur(150px)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ maxWidth: 460, width: "100%", textAlign: "center", position: "relative", zIndex: 2 }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(253,251,241,0.45)", marginBottom: 32 }}>
            Digitize your cookbooks
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <img src="/takeimage.svg" alt="Person photographing a cookbook" style={{ width: isMobile ? 150 : 190, height: "auto", opacity: 0.60 }} />
          </div>

          <div
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: isDragging ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: isDragging ? "1px solid rgba(244,197,66,0.55)" : isHovering ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 24,
              padding: isMobile ? "40px 28px 32px" : "56px 48px 40px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.25s, background 0.25s, transform 0.25s, box-shadow 0.25s",
              transform: isHovering && !isDragging ? "scale(1.03)" : "scale(1)",
              boxShadow: isHovering && !isDragging ? "0 24px 64px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.08)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                <path d="M17.5 9.5L15 13.5H8C6.9 13.5 6 14.4 6 15.5V34C6 35.1 6.9 36 8 36H38C39.1 36 40 35.1 40 34V15.5C40 14.4 39.1 13.5 38 13.5H31L28.5 9.5H17.5Z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="23" cy="25" r="6.5" stroke="white" strokeWidth="1.2" />
                <circle cx="33.5" cy="18" r="1.5" fill="white" fillOpacity="0.55" />
              </svg>
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 500, color: "#ffffff", marginBottom: 8, lineHeight: 1.3 }}>Drop a recipe page here</p>
            <p style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, fontFamily: "'Inter', sans-serif", marginBottom: 32 }}>or click to upload</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {["JPG", "PNG", "HEIC"].map(ext => (
                <span key={ext} style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "3px 9px" }}>{ext}</span>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
          </div>
        </div>
      </div>
    </>
  );
}
