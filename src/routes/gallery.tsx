import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchPublishedShaders, ensureSignedIn, upsertShader } from "../lib/supabase-sync";
import { useShaderStore } from "../lib/shader-store";
import type { ShaderEntry } from "../lib/shader-store";
import type { PassInfo } from "../lib/webgl-renderer";
import { supabase } from "../lib/supabase";
import { Logo } from "../components/Logo";
import { ShaderThumb } from "../components/ShaderThumb";

export const Route = createFileRoute("/gallery")({
    component: GalleryPage,
});

type Tab = "community" | "mine";

function resolvePassChain(shader: ShaderEntry, lookup: Map<string, ShaderEntry>): PassInfo[] {
    const pre = (shader.passes ?? [])
        .map((p) => {
            const s = lookup.get(p.id);
            if (!s) return null;
            return { source: s.fragmentSource, uniforms: s.uniforms, blendMode: p.blendMode, opacity: p.opacity };
        })
        .filter(Boolean) as PassInfo[];
    return [...pre, { source: shader.fragmentSource, uniforms: shader.uniforms, blendMode: shader.blendMode, opacity: shader.blendOpacity }];
}

function GalleryPage() {
    const navigate = useNavigate();
    const createShader = useShaderStore((s) => s.createShader);
    const updateShader = useShaderStore((s) => s.updateShader);
    const deleteShader = useShaderStore((s) => s.deleteShader);
    const setPublished = useShaderStore((s) => s.setPublished);
    const localShaders = useShaderStore((s) => s.shaders);

    const [tab, setTab] = useState<Tab>("community");
    const [communityShaders, setCommunityShaders] = useState<ShaderEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        fetchPublishedShaders()
            .then(setCommunityShaders)
            .catch((e) => setFetchError(e.message))
            .finally(() => setLoading(false));
    }, []);

    // Lookup map for pass chain resolution (local takes precedence for up-to-date uniforms)
    const communityLookup = useMemo(() => {
        const map = new Map<string, ShaderEntry>();
        for (const s of communityShaders) map.set(s.id, s);
        for (const s of localShaders) map.set(s.id, s);
        return map;
    }, [communityShaders, localShaders]);

    const localLookup = useMemo(() => {
        const map = new Map<string, ShaderEntry>();
        for (const s of localShaders) map.set(s.id, s);
        return map;
    }, [localShaders]);

    const ownIds = useMemo(() => new Set(localShaders.map((s) => s.id)), [localShaders]);

    // Pre-compute pass chains so ShaderThumb gets a stable reference per shader
    const communityChains = useMemo(() =>
        new Map(communityShaders.map((s) => [s.id, resolvePassChain(s, communityLookup)])),
        [communityShaders, communityLookup]
    );
    const localChains = useMemo(() =>
        new Map(localShaders.map((s) => [s.id, resolvePassChain(s, localLookup)])),
        [localShaders, localLookup]
    );

    async function handleFork(source: ShaderEntry) {
        const userId = await ensureSignedIn();
        const id = createShader();
        updateShader(id, {
            name: source.name + " (fork)",
            fragmentSource: source.fragmentSource,
            uniforms: source.uniforms,
            passes: source.passes,
        });
        const forked = useShaderStore.getState().shaders.find((s) => s.id === id);
        if (forked) await upsertShader(forked, userId);
        navigate({ to: "/editor/$shaderId", params: { shaderId: id } });
    }

    function handleDeleteConfirm(id: string) {
        deleteShader(id);
        setCommunityShaders((prev) => prev.filter((s) => s.id !== id));
        setDeleteConfirmId(null);
    }

    const deleteTarget =
        deleteConfirmId
            ? (localShaders.find((s) => s.id === deleteConfirmId) ?? communityShaders.find((s) => s.id === deleteConfirmId))
            : null;

    return (
        <div className="min-h-screen bg-surface-0 flex flex-col">
            <header className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/"><Logo className="text-base" /></Link>
                    <span className="text-border">/</span>
                    <span className="text-surface-4 text-xs">gallery</span>
                </div>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-surface-4 text-xs hover:text-white transition-colors"
                >
                    sign out
                </button>
            </header>

            {/* Tabs */}
            <div className="border-b border-border flex">
                {(["community", "mine"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-6 py-3 text-xs uppercase tracking-widest transition-colors border-r border-border ${
                            tab === t
                                ? "text-accent-bright bg-surface-1"
                                : "text-surface-4 hover:text-white"
                        }`}
                    >
                        {t === "community" ? "Community" : "My Shaders"}
                    </button>
                ))}
            </div>

            <main className="flex-1 flex flex-col items-center gap-8 px-6 py-12">

                {/* ── Community tab ── */}
                {tab === "community" && (
                    <>
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Community</h1>
                            <p className="text-surface-4 text-sm">Published shaders from all users.</p>
                        </div>

                        {loading && <p className="text-surface-4 text-xs animate-pulse">loading…</p>}
                        {fetchError && <p className="text-red-400 text-xs">Failed to load: {fetchError}</p>}

                        {!loading && !fetchError && communityShaders.length === 0 && (
                            <p className="text-surface-4 text-xs">
                                No published shaders yet. Open a shader in the editor and hit{" "}
                                <span className="text-white">publish</span>.
                            </p>
                        )}

                        {!loading && communityShaders.length > 0 && (
                            <div className="w-full max-w-3xl grid grid-cols-3 gap-3">
                                {communityShaders.map((s) => (
                                    <div
                                        key={s.id}
                                        className="group relative bg-surface-1 border border-border overflow-hidden flex flex-col"
                                    >
                                        <ShaderThumb passes={communityChains.get(s.id)!} />

                                        {ownIds.has(s.id) && (
                                            <button
                                                onClick={() => setDeleteConfirmId(s.id)}
                                                title="Delete"
                                                className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-surface-0/80 hover:bg-red-900 text-surface-4 hover:text-red-400 border border-border hover:border-red-800 transition-all opacity-0 group-hover:opacity-100 text-[10px]"
                                            >
                                                ×
                                            </button>
                                        )}

                                        <div className="p-3 flex flex-col gap-2">
                                            <p className="text-white text-xs font-medium">{s.name}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-surface-4 text-[10px]">
                                                    {new Date(s.updatedAt).toLocaleDateString()}
                                                </span>
                                                <button
                                                    onClick={() => handleFork(s)}
                                                    className="text-[10px] px-2 py-1 border border-border text-surface-4 hover:border-accent-bright hover:text-accent-bright transition-colors"
                                                >
                                                    fork →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── My Shaders tab ── */}
                {tab === "mine" && (
                    <>
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">My Shaders</h1>
                            <p className="text-surface-4 text-sm">Your shaders. Publish to share with the community.</p>
                        </div>

                        {localShaders.length === 0 && (
                            <p className="text-surface-4 text-xs">
                                No shaders yet.{" "}
                                <Link to="/" className="text-white hover:text-accent-bright transition-colors">
                                    Create one →
                                </Link>
                            </p>
                        )}

                        {localShaders.length > 0 && (
                            <div className="w-full max-w-3xl grid grid-cols-3 gap-3">
                                {localShaders.map((s) => (
                                    <div
                                        key={s.id}
                                        className="group relative bg-surface-1 border border-border overflow-hidden flex flex-col"
                                    >
                                        <ShaderThumb passes={localChains.get(s.id)!} />

                                        <button
                                            onClick={() => setDeleteConfirmId(s.id)}
                                            title="Delete"
                                            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-surface-0/80 hover:bg-red-900 text-surface-4 hover:text-red-400 border border-border hover:border-red-800 transition-all opacity-0 group-hover:opacity-100 text-[10px]"
                                        >
                                            ×
                                        </button>

                                        <div className="p-3 flex flex-col gap-2">
                                            <p className="text-white text-xs font-medium">{s.name}</p>
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => setPublished(s.id, !s.published)}
                                                    className={`text-[10px] px-2 py-0.5 border transition-colors ${
                                                        s.published
                                                            ? "border-accent text-accent hover:border-surface-4 hover:text-surface-4"
                                                            : "border-border text-surface-4 hover:border-accent hover:text-accent"
                                                    }`}
                                                >
                                                    {s.published ? "published" : "publish"}
                                                </button>
                                                <button
                                                    onClick={() => navigate({ to: "/editor/$shaderId", params: { shaderId: s.id } })}
                                                    className="text-[10px] px-2 py-1 border border-border text-surface-4 hover:border-accent-bright hover:text-accent-bright transition-colors"
                                                >
                                                    edit →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Delete confirmation modal */}
            {deleteConfirmId && deleteTarget && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                    onClick={() => setDeleteConfirmId(null)}
                >
                    <div
                        className="bg-surface-1 border border-border p-6 flex flex-col gap-4 w-80"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-white text-sm font-medium">Delete shader?</p>
                        <p className="text-surface-4 text-xs leading-relaxed">
                            <span className="text-white">{deleteTarget.name}</span> will be permanently deleted and unpublished.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-3 py-1.5 text-xs text-surface-4 border border-border hover:text-white transition-colors"
                            >
                                cancel
                            </button>
                            <button
                                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                                className="px-3 py-1.5 text-xs bg-red-900 hover:bg-red-800 text-red-400 border border-red-800 transition-colors"
                            >
                                delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
