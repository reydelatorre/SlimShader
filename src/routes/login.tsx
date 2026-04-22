import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Logo } from "../components/Logo";

export const Route = createFileRoute("/login")({
    component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot";

function LoginPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function switchMode(m: Mode) {
        setMode(m);
        setError(null);
        setMessage(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            if (mode === "signup") {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage("Check your email for a confirmation link.");
            } else if (mode === "forgot") {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) throw error;
                setMessage("Password reset email sent — check your inbox.");
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                navigate({ to: "/" });
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-xs flex flex-col gap-8">
                <div className="text-center">
                    <Logo className="text-2xl" />
                    <p className="text-surface-4 text-xs mt-2">GLSL editor + Love2D exporter</p>
                </div>

                <div className="bg-surface-1 border border-border p-6 flex flex-col gap-5">
                    {mode !== "forgot" && (
                        <div className="flex overflow-hidden border border-border">
                            {(["signin", "signup"] as Mode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => switchMode(m)}
                                    className={`flex-1 text-[10px] py-2 uppercase tracking-widest transition-colors ${
                                        mode === m
                                            ? "bg-surface-2 text-white"
                                            : "text-surface-4 hover:text-white"
                                    }`}
                                >
                                    {m === "signin" ? "Sign in" : "Sign up"}
                                </button>
                            ))}
                        </div>
                    )}

                    {mode === "forgot" && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => switchMode("signin")}
                                className="text-surface-4 hover:text-white transition-colors text-[10px]"
                            >
                                ← back
                            </button>
                            <span className="text-surface-4 text-[10px] uppercase tracking-widest">Reset password</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <input
                            type="email"
                            placeholder="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-surface-2 border border-border px-3 py-2 text-white text-xs placeholder:text-surface-4 focus:outline-none focus:border-accent-bright"
                        />
                        {mode !== "forgot" && (
                            <input
                                type="password"
                                placeholder="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-surface-2 border border-border px-3 py-2 text-white text-xs placeholder:text-surface-4 focus:outline-none focus:border-accent-bright"
                            />
                        )}

                        {error && <p className="text-red-400 text-[10px] leading-relaxed">{error}</p>}
                        {message && <p className="text-green-400 text-[10px] leading-relaxed">{message}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-1 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 text-white text-xs font-medium transition-colors"
                        >
                            {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
                        </button>

                        {mode === "signin" && (
                            <button
                                type="button"
                                onClick={() => switchMode("forgot")}
                                className="text-surface-4 hover:text-white text-[10px] transition-colors text-center"
                            >
                                Forgot password?
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
