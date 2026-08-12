import { KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthHeader } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <AuthHeader
            title="Reset your password"
            subtitle="We will send a one-time code to your registered email."
          />
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
