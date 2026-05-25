import { useState, useEffect } from "react";
import { getAuthToken, clearAuthToken } from "@/lib/auth"; // ← importa as funções centrais

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken(); // ← usa a função central
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        clearAuthToken(); // ← limpa tudo de uma vez
        setLoading(false);
      });
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}