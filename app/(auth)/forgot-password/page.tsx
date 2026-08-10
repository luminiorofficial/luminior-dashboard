import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthHeader } from "@/components/auth/auth-header";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <AuthHeader title="Reset your password" />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            Self-service password reset isn&apos;t available yet. Ask your
            company admin to reset your password from the Team page, then
            sign in with the new one.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
