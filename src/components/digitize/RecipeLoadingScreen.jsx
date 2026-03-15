import React, { useRef, useEffect } from "react";
import TypewriterLoader from "./TypewriterLoader";

export default function RecipeLoadingScreen({ extracting, translating, generatingImage, messages }) {
  const isActive = extracting || translating || generatingImage;
  const videoRef = useRef(null);
  const rafRef = useRef(null);

  // Ping-pong: play forward, then rewind frame-by-frame, then repeat
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const rewind = () => {
      video.currentTime = Math.max(0, video.currentTime - 0.04);
      if (video.currentTime > 0) {
        rafRef.current = requestAnimationFrame(rewind);
      } else {
        video.play();
      }
    };

    const handleEnded = () => { rafRef.current = requestAnimationFrame(rewind); };
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("ended", handleEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div style={{ textAlign: "center", padding: "40px 0 0" }}>
      <TypewriterLoader messages={messages} isActive={isActive} />
      <div style={{ width: 200, height: 200, overflow: "hidden", position: "relative", margin: "0 auto", borderRadius: 20, background: "transparent" }}>
        <video
          ref={videoRef}
          src="/loading.mp4"
          autoPlay
          muted
          playsInline
          style={{ position: "absolute", width: "195%", height: "auto", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        />
      </div>
    </div>
  );
}
