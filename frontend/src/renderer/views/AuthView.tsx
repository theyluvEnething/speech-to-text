import React, { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSignIn, useSignUp, useAuth } from "@clerk/clerk-react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store";

type Mode = "signin" | "signup" | "forgot" | "verify" | "new_password";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
}): React.ReactElement {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-ink-3">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          disabled={disabled}
          className="bg-input border-line text-sm focus:border-ink-3 h-8 pr-8"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function AuthView(): React.ReactElement {
  const { t } = useTranslation();
  const { signIn, isLoaded: signInLoaded, setActive: setSignInActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded, setActive: setSignUpActive } = useSignUp();
  const { isLoaded: authLoaded } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingSignInId, setPendingSignInId] = useState<string | null>(null);

  const isLoading = !signInLoaded || !signUpLoaded || !authLoaded;

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError("");
    setPending(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        useStore.setState({ isAuthenticated: true });
      } else if (result.status === "needs_second_factor") {
        setPendingSignInId(result.id ?? null);
        setMode("verify");
        setError("");
      } else {
        setError(t("auth.unhandledSignInStatus", { status: result.status }));
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || t("auth.signInFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setPending(true);
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        useStore.setState({ isAuthenticated: true });
      } else if ((result.status as string) === "needs_verification") {
        setPendingSignInId(result.id ?? null);
        setMode("verify");
        setError("");
      } else {
        setError(t("auth.unhandledSignUpStatus", { status: result.status }));
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || t("auth.signUpFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn || !pendingSignInId) return;
    setError("");
    setPending(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      } as any);
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        useStore.setState({ isAuthenticated: true });
      } else {
        setError(t("auth.invalidCode"));
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || t("auth.verificationFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError("");
    setPending(true);
    try {
      const result = await signIn.create({
        identifier: email,
        strategy: "reset_password_email_code",
      });
      setPendingSignInId(result.id ?? null);
      setMode("verify");
      setError("");
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || t("auth.sendCodeFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn || !pendingSignInId) return;
    setError("");
    setPending(true);
    try {
      await signIn.resetPassword({ password, signOutOfOtherSessions: true });
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      } as any);
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        useStore.setState({ isAuthenticated: true });
      } else {
        setError(t("auth.resetFailed"));
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || t("auth.resetFailed"));
    } finally {
      setPending(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setCode("");
    setError("");
    setPendingSignInId(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetForm();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-ink-3 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-ink">
            Wavely
          </span>
        </div>

        <Card className="border-line bg-background shadow-wv-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-ink">
              {mode === "signin" && t("auth.signIn")}
              {mode === "signup" && t("auth.createAccount")}
              {mode === "forgot" && t("auth.resetPassword")}
              {mode === "verify" && t("auth.checkEmail")}
              {mode === "new_password" && t("auth.chooseNewPassword")}
            </CardTitle>
            {mode === "verify" && (
              <p className="text-xs text-ink-3">
                {t("auth.emailSentTo", { email })}
              </p>
            )}
          </CardHeader>

          <CardContent>
            <form
              onSubmit={
                mode === "signin" ? handleSignIn
                : mode === "signup" ? handleSignUp
                : mode === "forgot" ? handleForgot
                : mode === "verify" ? handleVerify
                : handleNewPassword
              }
              className="space-y-4"
            >
              {error && (
                <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-300 bg-red-500/10 rounded-md px-3 py-2 border border-red-500/20">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {(mode === "signin" || mode === "signup" || mode === "forgot") && (
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-ink-3">
                    {t("auth.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                    required
                    disabled={pending}
                    className="bg-input border-line text-sm focus:border-ink-3 h-8"
                  />
                </div>
              )}

              {(mode === "signin" || mode === "signup" || mode === "new_password") && (
                <PasswordInput
                  id="password"
                  label={mode === "new_password" ? t("auth.newPassword") : t("auth.password")}
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  disabled={pending}
                />
              )}

              {mode === "verify" && (
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs text-ink-3">
                    {t("auth.verificationCode")}
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("auth.codePlaceholder")}
                    required
                    maxLength={6}
                    disabled={pending}
                    className="bg-input border-line text-sm focus:border-ink-3 h-8 tracking-[0.25em] text-center"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={pending}
                className="w-full h-9 text-sm bg-btn-primary hover:opacity-90 text-btn-primary-ink"
              >
                {pending ? (
                  <span className="w-4 h-4 border-2 border-btn-primary-ink border-t-transparent rounded-full animate-spin" />
                ) : mode === "signin" ? (
                  t("auth.signIn")
                ) : mode === "signup" ? (
                  t("auth.createAccount")
                ) : mode === "forgot" ? (
                  t("auth.sendResetCode")
                ) : mode === "verify" ? (
                  t("auth.verifyCode")
                ) : (
                  t("auth.setPassword")
                )}
              </Button>

              {mode === "signin" || mode === "signup" ? (
                <div className="flex items-center justify-between text-xs text-ink-3 pt-1">
                  {mode === "signin" ? (
                    <>
                      <button type="button" onClick={() => switchMode("signup")} className="hover:text-ink transition-colors">
                        {t("auth.createAccount")}
                      </button>
                      <button type="button" onClick={() => switchMode("forgot")} className="hover:text-ink transition-colors">
                        {t("auth.forgotPassword")}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => switchMode("signin")} className="hover:text-ink transition-colors">
                      {t("auth.alreadyHaveAccount")}
                    </button>
                  )}
                </div>
              ) : (mode === "forgot" || mode === "verify" || mode === "new_password") && (
                <button type="button" onClick={() => switchMode("signin")} className="block text-xs text-ink-3 hover:text-ink transition-colors text-center pt-1 w-full">
                  {t("auth.backToSignIn")}
                </button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AuthView;
