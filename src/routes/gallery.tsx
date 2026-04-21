import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchPublishedShaders, ensureSignedIn, upsertShader } from "../lib/supabase-sync";
import { useShaderStore } from "../lib/shader-store";
import type { ShaderEntry } from "../lib/shader-store";

export const Route = createFileRoute("/gallery")({
    component: GalleryPage,
});

function GalleryPage() {
    const navigate = useNavigate();
    const createShader = useShaderStore((s) => s.createShader);
    const updateShader = useShaderStore((s) => s.updateShader);

    const [shaders, setShaders] = useState<ShaderEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPublishedShaders()
            .then(setShaders)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleFork(source: ShaderEntry) {
        const userId = await ensureSignedIn();
        const id = createShader();
        updateShader(id, {
            name: source.name + " (fork)",
            fragmentSource: source.fragmentSource,
            uniforms: source.uniforms,
        });
        // push the fork to remote immediately so it persists
        const forked = useShaderStore.getState().shaders.find((s) => s.id === id);
        if (forked) await upsertShader(forked, userId);
        navigate({ to: "/editor/$shaderId", params: { shaderId: id } });
    }

    return (
        <div className="min-h-screen bg-surface-0 flex flex-col">
            <header className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="text-accent-bright font-bold text-base tracking-wider hover:text-white transition-colors"
                    >
                        SLIM<span className="text-white">SHADER</span>
                    </Link>
                    <span className="text-border">/</span>
                    <span className="text-surface-4 text-xs">gallery</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center gap-8 px-6 py-12">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Gallery</h1>
                    <p className="text-surface-4 text-sm">Published shaders from the community.</p>
                </div>

                {loading && (
                    <p className="text-surface-4 text-xs animate-pulse">loading…</p>
                )}

                {error && (
                    <p className="text-red-400 text-xs">Failed to load: {error}</p>
                )}

                {!loading && !error && shaders.length === 0 && (
                    <p className="text-surface-4 text-xs">
                        No published shaders yet. Open a shader in the editor and hit{" "}
                        <span className="text-white">publish</span>.
                    </p>
                )}

                {!loading && shaders.length > 0 && (
                    <div className="w-full max-w-3xl grid grid-cols-3 gap-3">
                        {shaders.map((s) => (
                            <div
                                key={s.id}
                                className="group bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3"
                            >
                                <p className="text-white text-xs font-medium">{s.name}</p>
                                <p className="text-surface-4 text-[10px]">
                                    {new Date(s.updatedAt).toLocaleDateString()}
                                </p>
                                <button
                                    onClick={() => handleFork(s)}
                                    className="mt-auto text-[10px] px-3 py-1.5 border border-border rounded text-surface-4 hover:border-accent-bright hover:text-accent-bright transition-colors"
                                >
                                    fork →
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
