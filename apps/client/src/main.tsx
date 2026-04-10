import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./font.css";

import App from "./App.tsx";
import { ThemeProvider } from "./app/providers/theme-provider.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { SupabaseAuthProvider } from "./contexts/SupabaseAuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
      <SupabaseAuthProvider>
        <App />
        <Toaster />
      </SupabaseAuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
