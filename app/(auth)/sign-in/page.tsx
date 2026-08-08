"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const ok = await signIn(email, password);
    if (ok) {
      const redirect = params.get("redirect") || "/crm";
      router.replace(redirect);
      return;
    }

    setError("We could not sign you in with those credentials.");
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Luminior Dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
            <p className="mt-2 text-sm text-slate-600">Enter your work email and password to access CRM tools.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none ring-0" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
              <input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none ring-0" />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here? <Link href="/sign-up" className="font-semibold text-slate-900">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
