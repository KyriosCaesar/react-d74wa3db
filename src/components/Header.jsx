import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Header({ isProcessing = false }) {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = () => { navigate("/"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
      <header
        className="site-header"
        style={{
          background: "rgba(253,251,241,0.30)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Hamburger menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowNavMenu(m => !m)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 6, display: "flex", flexDirection: "column", gap: 4.5, alignItems: "flex-start" }}
          >
            <span style={{ display: "block", width: 22, height: 2, background: "#2c2416", borderRadius: 2 }} />
            <span style={{ display: "block", width: 22, height: 2, background: "#2c2416", borderRadius: 2 }} />
            <span style={{ display: "block", width: 15, height: 2, background: "#2c2416", borderRadius: 2 }} />
          </button>

          {showNavMenu && (
            <div style={{ position: "absolute", top: 46, left: 0, background: "#FDFBF1", borderRadius: 12, boxShadow: "0 8px 32px rgba(44,36,22,0.15)", border: "1px solid #e8ddc8", minWidth: 180, zIndex: 200, overflow: "hidden" }}>
              {user ? (
                <button
                  onClick={() => { goHome(); setShowNavMenu(false); }}
                  style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#2c2416", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f4ede0"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="#b8a888"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="#b8a888"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="#b8a888"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="#b8a888"/></svg>
                  My Library
                </button>
              ) : (
                <button
                  onClick={() => { setShowLoginModal(true); setShowNavMenu(false); }}
                  style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#2c2416", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f4ede0"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#b8a888"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#b8a888" strokeWidth="2" strokeLinecap="round"/></svg>
                  Sign in
                </button>
              )}
            </div>
          )}
        </div>

        {/* Logo — absolutely centred */}
        <div
          onClick={goHome}
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
        >
          {!isProcessing && <img src="/favicon.png" alt="" style={{ height: 30, width: "auto" }} />}
          <span style={{ fontWeight: 700, fontSize: 20, color: "#1a1208", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "-0.4px" }}>
            Cookable
          </span>
        </div>

        {/* Profile / avatar */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => user ? setShowUserMenu(m => !m) : setShowLoginModal(true)}
            style={{ width: 38, height: 38, borderRadius: "50%", background: "#e8ddc8", border: "2px solid #d4c5a9", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden" }}
          >
            {user?.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#b8a888"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#b8a888" strokeWidth="2" strokeLinecap="round"/></svg>
            }
          </div>

          {showUserMenu && user && (
            <div style={{ position: "absolute", top: 46, right: 0, background: "#FDFBF1", borderRadius: 12, boxShadow: "0 8px 32px rgba(44,36,22,0.15)", border: "1px solid #e8ddc8", minWidth: 200, zIndex: 200, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0ebe0" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#2c2416", fontFamily: "'Inter', sans-serif", margin: 0 }}>{user.user_metadata?.full_name || user.email}</p>
                <p style={{ fontSize: 12, color: "#9a8060", fontFamily: "'Inter', sans-serif", margin: "2px 0 0" }}>{user.email}</p>
              </div>
              <button
                onClick={() => { signOut(); setShowUserMenu(false); }}
                style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#c0503a", fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fdf0e8"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Login modal */}
      {showLoginModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(44,36,22,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
        >
          <div style={{ background: "#FDFBF1", borderRadius: 20, padding: "40px 36px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
            <div style={{ width: 56, height: 56, background: "#f4ede0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <img src="/favicon.png" alt="" style={{ height: 30 }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2c2416", margin: "0 0 8px" }}>Sign in to Cookable</h2>
            <p style={{ fontSize: 14, color: "#9a8060", margin: "0 0 28px", lineHeight: 1.6 }}>Save your recipes and access them from any device.</p>
            <button
              onClick={signInWithGoogle}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 20px", borderRadius: 10, border: "1.5px solid #d4c5a9", background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#2c2416", fontFamily: "'Inter', sans-serif", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9f4ed"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}

      {/* Close menus when clicking outside */}
      {(showNavMenu || showUserMenu) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => { setShowNavMenu(false); setShowUserMenu(false); }} />
      )}
    </>
  );
}
