import { SetPasswordForm } from "@/components/auth/set-password-form";

/** Landing target for the forgot-password email (resetPasswordForEmail's redirectTo, src/hooks/use-session.tsx). */
export default function ResetPasswordPage() {
  return <SetPasswordForm mode="recovery" />;
}
