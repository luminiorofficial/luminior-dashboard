"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { GoogleButton } from "@/components/auth/google-button";
import { useAuth } from "@/hooks/use-auth";

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const ok = await signIn(email, password);
    if (ok) {
      const redirect = params.get("redirect") || "/dashboard";
      router.replace(redirect);
      return;
    }

    const message = "We could not sign you in with those credentials.";
    setError(message);
    toast.error(message);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Password">
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* <div className="relative text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div> */}

      <GoogleButton />
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginFormInner />
    </Suspense>
  );
}
