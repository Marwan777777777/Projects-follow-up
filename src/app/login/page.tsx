import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Projects Follow Up
          </h1>
          <p className="mt-1 text-sm text-zinc-500">ELV & Construction</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-zinc-500">Loading\u2026</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
