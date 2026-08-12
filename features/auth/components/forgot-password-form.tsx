"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const GENERIC_MESSAGE =
  "If an account exists with this email, we have sent a password reset OTP.";

type Step = "request" | "verify";

async function responseMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  return data?.error || data?.message;
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function requestOtp(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const message = await responseMessage(response);
      if (!response.ok) {
        setError(message || "We could not process that request.");
        return;
      }

      setEmail(email.toLowerCase().trim());
      setStep("verify");
      setCooldown(60);
      toast.success(GENERIC_MESSAGE);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const message = await responseMessage(response);
      if (!response.ok) {
        setError(message || "We could not verify that OTP.");
        return;
      }
      router.push("/reset-password");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "request") {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Field label="Registered email">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending OTP…" : "Send reset OTP"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {GENERIC_MESSAGE}
      </div>
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Field label="Email">
        <Input type="email" value={email} readOnly aria-readonly="true" />
      </Field>
      <Field label="6-digit OTP">
        <Input
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(event) =>
            setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="text-center text-lg tracking-[0.35em]"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
        {busy ? "Verifying…" : "Verify OTP"}
      </Button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          disabled={busy || cooldown > 0}
          onClick={() => void requestOtp()}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => {
            setStep("request");
            setOtp("");
            setError("");
          }}
        >
          Change email
        </Button>
      </div>
    </form>
  );
}
