import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full max-w-sm animate-pulse-soft rounded-panel bg-surface" aria-busy="true" />}>
      <AuthGate mode="cadastro" />
    </Suspense>
  );
}
