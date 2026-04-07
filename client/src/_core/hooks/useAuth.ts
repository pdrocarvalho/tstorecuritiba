import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

// NOVA LINHA: Variável inteligente para a API
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    // ALTERADO: Usa a variável API_URL
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setLoading(false);
      });
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}