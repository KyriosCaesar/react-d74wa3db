import React, { useState, useEffect } from "react";

export default function TypewriterLoader({ messages, isActive }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | erasing

  useEffect(() => {
    if (!isActive) return;
    const msg = messages[index];
    if (phase === "typing") {
      if (displayed.length < msg.length) {
        const t = setTimeout(() => setDisplayed(msg.slice(0, displayed.length + 1)), 48);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setPhase("erasing"), 3800);
        return () => clearTimeout(t);
      }
    }
    if (phase === "erasing") {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 28);
        return () => clearTimeout(t);
      } else {
        setIndex(i => (i + 1) % messages.length);
        setPhase("typing");
      }
    }
  }, [isActive, displayed, phase, index, messages]);

  // Reset when the message set changes (extraction → translation phase)
  useEffect(() => {
    setIndex(0);
    setDisplayed("");
    setPhase("typing");
  }, [messages]);

  if (!isActive) return null;

  return (
    <div style={{ textAlign: "center", marginBottom: 32, minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: 26, fontFamily: "'Playfair Display', serif", color: "#4a3520", maxWidth: 600, margin: "0 auto", lineHeight: 1.4 }}>
        {displayed}
        <span style={{ display: "inline-block", width: 2, height: "1.1em", background: "#4a3520", verticalAlign: "text-bottom", marginLeft: 2, animation: "twBlink 1s step-end infinite" }} />
      </p>
      <style>{`@keyframes twBlink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
