import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc";
import "./index.css";

import App from "./App";

const queryClient = new QueryClient();

// NOVA LINHA: Lê a variável da Vercel ou usa o localhost por defeito
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // ALTERADO: Usa a variável API_URL em vez do texto fixo
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