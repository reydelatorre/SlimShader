import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Logo } from "../components/Logo";

export const Route = createFileRoute("/reset-password")({
    component: ResetPasswordPage,
});

function ResetPasswordPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password !== confirm) {
            setError("Passwords don't match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            navigate({ to: "/" });
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
                    <span className="text-surface-4 text-[10px] uppercase tracking-widest">Set new password</span>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <input
                            type="password"
                            placeholder="new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoFocus
                            className="bg-surface-2 border border-border px-3 py-2 text-white text-xs placeholder:text-surface-4 focus:outline-none focus:border-accent-bright"
                        />
                        <input
                            type="password"
                            placeholder="confirm password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            className="bg-surface-2 border border-border px-3 py-2 text-white text-xs placeholder:text-surface-4 focus:outline-none focus:border-accent-bright"
                        />

                        {error && <p className="text-red-400 text-[10px] leading-relaxed">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-1 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 text-white text-xs font-medium transition-colors"
                        >
                            {loading ? "…" : "Update password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
