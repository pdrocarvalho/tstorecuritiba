import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc";
import "./index.css";

import App from "./App";

const queryClient = new QueryClient();

// Lógica para detectar a URL da API
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// LOG DE DEPURAÇÃO: Ajuda-nos a ver no F12 qual URL o sistema carregou
console.log("🚀 Sistema T Store iniciado com API em:", API_URL);

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
    }),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);