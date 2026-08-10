"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordMeter } from "@/components/auth/password-meter";
import { GoogleButton } from "@/components/auth/google-button";
import { useAuth } from "@/hooks/use-auth";

function SignupFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const refCode = params.get("ref");
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const result = await signUp(name, email, password, refCode);
    if (result.ok) {
      router.replace("/dashboard");
      return;
    }

    const message = result.error || "We could not create your account.";
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

        <Field label="Full name">
          <Input
            required
            minLength={2}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="mt-2">
            <PasswordMeter password={password} />
          </div>
        </Field>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div>

      <GoogleButton />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function SignupForm() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SignupFormInner />
    </Suspense>
  );
}
