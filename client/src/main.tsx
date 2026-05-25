import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { getAuthToken } from "@/lib/auth";
import "./index.css";

import App from "./App";

const queryClient = new QueryClient();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

console.log("🚀 Sistema T Store iniciado com API em:", API_URL);

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers() {
        const token = getAuthToken();
        return token
          ? { Authorization: `Bearer ${token}` }
          : {};
      },
    }),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
