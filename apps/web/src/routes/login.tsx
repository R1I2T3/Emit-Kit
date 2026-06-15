import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@Emitkit/ui/components/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with GitHub");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full w-full flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.05)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Background ambient decorative glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none -z-10 animate-[pulse_6s_infinite_alternate]" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-[pulse_8s_infinite_alternate_2s]" />

      {/* Main glassmorphic login card */}
      <div className="relative w-full max-w-[420px] bg-card/40 backdrop-blur-2xl border border-border/80 rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-8 overflow-hidden transition-all duration-300">
        {/* Top decorative gradient border highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        {/* Branding header */}
        <div className="flex flex-col items-center space-y-4 text-center">
          {/* Packaging Code/SDK Icon */}
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)] group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none" />
            <svg className="w-7 h-7 text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
              <polyline points="9 8.5 7.5 9.5 9 10.5" strokeWidth="1.5" stroke="rgb(168, 85, 247)" />
              <polyline points="15 8.5 16.5 9.5 15 10.5" strokeWidth="1.5" stroke="rgb(168, 85, 247)" />
            </svg>
          </div>
          
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-foreground to-foreground/80 bg-clip-text text-transparent">
              Welcome to Emitkit
            </h1>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mx-auto">
              Sign in to generate, test, and publish production-ready SDKs.
            </p>
          </div>
        </div>

        {/* Action button container */}
        <div className="space-y-4">
          <Button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-6 px-4 text-sm font-semibold rounded-2xl bg-zinc-950 border border-zinc-800/80 text-zinc-100 hover:bg-zinc-900 hover:border-zinc-700/80 hover:text-white transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-indigo-500/10 hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden group"
            onClick={handleGitHubSignIn}
            disabled={isLoading}
          >
            {/* Animated overlay gradient on hover */}
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-indigo-400 z-10"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-5 h-5 fill-current z-10"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            )}
            
            <span className="z-10">
              {isLoading ? "Connecting to GitHub..." : "Continue with GitHub"}
            </span>
          </Button>
        </div>

        {/* Card Footer Features Grid */}
        <div className="border-t border-border/50 pt-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center space-y-1">
              <div className="p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-indigo-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400">Secure Access</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-indigo-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400">Instant Sync</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-indigo-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400">Auto Deploy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

