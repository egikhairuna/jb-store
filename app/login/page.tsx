"use client";

import { Suspense } from "react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

// ─── Inner component ────────────────────────────────────────────
// useSearchParams() must live inside a component that is wrapped
// by <Suspense>. Next.js requires this for static prerendering.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/pos";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username/email or password. Please try again.");
        return;
      }

      // Success — redirect to the originally requested page
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm space-y-8 rounded-2xl border border-white bg-white/10 px-8 py-10 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg overflow-hidden">
          <Image
            src="/icon-james.svg"
            alt="James Boogie"
            width={56}
            height={56}
            className="object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">James Boogie POS</h1>
          <p className="text-sm text-white/70 mt-1">
            Sign in to your account to continue
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-white/90">Email / Username</Label>
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            placeholder="Input username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={isLoading}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Input your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-white text-black hover:bg-white/90"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-white/40">
        JB-POS — Internal Staff Only
      </p>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────
// The outer page wraps LoginForm in <Suspense> so Next.js can
// statically prerender the shell while the inner component reads
// useSearchParams() on the client.
export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background Image */}
      <Image
        src="/lofty-bg.jpg"
        alt="Background"
        fill
        className="object-cover object-center"
        priority
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* LoginForm is inside Suspense so useSearchParams() is allowed */}
      <Suspense
        fallback={
          <div className="relative z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      {/* Screen Footer */}
      <div className="absolute bottom-6 w-full text-center z-10 px-4">
        <p className="text-[10px] text-white/30 uppercase font-medium">
          © {new Date().getFullYear()} James Boogie • Woocommerce Based POS • v1.0.0 BY Alghifari Khairuna 
        </p>
      </div>
    </div>
  );
}
