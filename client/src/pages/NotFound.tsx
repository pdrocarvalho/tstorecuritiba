import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl text-gray-600 mt-4">Página não encontrada.</p>
        <Link href="/">
          <Button className="mt-6">Voltar ao início</Button>
        </Link>
      </div>
    </div>
  );
}