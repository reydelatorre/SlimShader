import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchShaderById } from "../lib/supabase-sync";
import type { ShaderDetail } from "../lib/supabase-sync";
import type { ShaderEntry } from "../lib/shader-store";
import type { PassInfo } from "../lib/webgl-renderer";
import { ShaderPreview } from "../components/ShaderPreview";
import { Logo } from "../components/Logo";

export const Route = createFileRoute("/shader/$shaderId")({
    component: ShaderDetailPage,
});

function resolvePassChain(shader: ShaderEntry, lookup: Map<string, ShaderEntry>): PassInfo[] {
    const pre = (shader.passes ?? [])
        .map((p) => {
            const s = lookup.get(p.id);
            if (!s) return null;
            return { source: s.fragmentSource, uniforms: s.uniforms, blendMode: p.blendMode, opacity: p.opacity };
        })
        .filter(Boolean) as PassInfo[];
    return [...pre, {
        source: shader.fragmentSource,
        uniforms: shader.uniforms,
        blendMode: shader.blendMode,
        opacity: shader.blendOpacity,
    }];
}

function ShaderDetailPage() {
    const { shaderId } = Route.useParams();
    const [shader, setShader] = useState<ShaderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [rendererError, setRendererError] = useState<import("../lib/webgl-renderer").RendererError | null>(null);

    useEffect(() => {
        fetchShaderById(shaderId)
            .then((s) => {
                if (!s) setNotFound(true);
                else setShader(s);
            })
            .finally(() => setLoading(false));
    }, [shaderId]);

    const passes = useMemo<PassInfo[]>(() => {
        if (!shader) return [];
        const lookup = new Map<string, ShaderEntry>();
        for (const dep of shader.passDeps) lookup.set(dep.id, dep);
        return resolvePassChain(shader, lookup);
    }, [shader]);

    return (
        <div className="min-h-screen bg-surface-0 flex flex-col">
            <header className="border-b border-border px-6 py-4 flex items-center gap-3">
                <Link to="/gallery">
                    <Logo className="text-base" />
                </Link>
                <span className="text-border">/</span>
                <Link
                    to="/gallery"
                    className="text-surface-4 text-xs hover:text-white transition-colors"
                >
                    gallery
                </Link>
                {shader && (
                    <>
                        <span className="text-border">/</span>
                        <span className="text-white text-xs">{shader.name}</span>
                    </>
                )}
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
                {loading && (
                    <p className="text-surface-4 text-xs animate-pulse">loading…</p>
                )}

                {notFound && (
                    <div className="text-center flex flex-col gap-3">
                        <p className="text-white text-sm">Shader not found.</p>
                        <p className="text-surface-4 text-xs">
                            This shader may not exist or isn't published.
                        </p>
                        <Link
                            to="/gallery"
                            className="text-accent-bright text-xs hover:underline"
                        >
                            ← back to gallery
                        </Link>
                    </div>
                )}

                {shader && (
                    <div className="w-full max-w-3xl flex flex-col gap-6">
                        {/* Preview */}
                        <div className="w-full border border-border overflow-hidden" style={{ aspectRatio: "16/9" }}>
                            <ShaderPreview passes={passes} onError={setRendererError} />
                        </div>

                        {rendererError && (
                            <pre className="text-red-400 text-[10px] bg-surface-1 border border-red-900 p-3 whitespace-pre-wrap leading-relaxed">
                                {rendererError.message}
                            </pre>
                        )}

                        {/* Metadata */}
                        <div className="flex items-end justify-between">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-white text-xl font-bold tracking-tight">
                                    {shader.name}
                                </h1>
                                <div className="flex items-center gap-3">
                                    {shader.username && (
                                        <span className="text-accent-bright text-xs">@{shader.username}</span>
                                    )}
                                    <span className="text-surface-4 text-[10px]">
                                        {new Date(shader.updatedAt).toLocaleDateString()}
                                    </span>
                                    {shader.passes.length > 0 && (
                                        <span className="text-surface-4 text-[10px]">
                                            {shader.passes.length + 1} passes
                                        </span>
                                    )}
                                </div>
                            </div>

                            <Link
                                to="/gallery"
                                className="text-surface-4 text-xs hover:text-white transition-colors"
                            >
                                ← gallery
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
