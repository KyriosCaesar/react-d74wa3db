import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Header from "./components/Header";
import LibraryPage from "./pages/LibraryPage";
import DigitizePage from "./pages/DigitizePage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import "./style.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppShell() {
  const location = useLocation();
  const isRoot = location.pathname === "/";
  const isDigitize = location.pathname === "/digitize";

  return (
    <div style={{
      minHeight: "100vh",
      background: "transparent",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#2c2416",
    }}>
      <Header />
      {isDigitize && <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: -1 }} />}
      <main
        className="main-content"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          ...(isRoot && { padding: 0 }),
        }}
      >
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/digitize" element={<DigitizePage />} />
          <Route path="/recipe/:id" element={<RecipeDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
