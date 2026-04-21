import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useShaderStore } from "../lib/shader-store";
import { supabase } from "../lib/supabase";
import { Logo } from "./Logo";
import type { RendererError, PassInfo } from "../lib/webgl-renderer";
import { ShaderPreview } from "./ShaderPreview";
import { ShaderEditor } from "./ShaderEditor";
import { UniformsPanel } from "./UniformsPanel";
import { PassesPanel } from "./PassesPanel";
import { ExportPanel } from "./ExportPanel";

type RightPanel = "uniforms" | "passes" | "export";

export function EditorPage() {
    const { shaderId } = useParams({ from: "/editor/$shaderId" });
    const navigate = useNavigate();
    const shader = useShaderStore((s) => s.shaders.find((sh) => sh.id === shaderId));
    const updateShader = useShaderStore((s) => s.updateShader);
    const setPublished = useShaderStore((s) => s.setPublished);
    const allShaders = useShaderStore((s) => s.shaders);
    const addUniform = useShaderStore((s) => s.addUniform);
    const updateUniform = useShaderStore((s) => s.updateUniform);
    const removeUniform = useShaderStore((s) => s.removeUniform);
    const addPass = useShaderStore((s) => s.addPass);
    const removePass = useShaderStore((s) => s.removePass);
    const reorderPass = useShaderStore((s) => s.reorderPass);

    const [localSource, setLocalSource] = useState(shader?.fragmentSource ?? "");
    const [error, setError] = useState<RendererError | null>(null);
    const [rightPanel, setRightPanel] = useState<RightPanel>("uniforms");
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(shader?.name ?? "");
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!shader) navigate({ to: "/" });
    }, [shader, navigate]);

    useEffect(() => {
        if (shader) {
            setLocalSource(shader.fragmentSource);
            setNameValue(shader.name);
        }
    }, [shaderId]);

    const handleSourceChange = useCallback(
        (value: string) => {
            setLocalSource(value);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                updateShader(shaderId, { fragmentSource: value });
            }, 500);
        },
        [shaderId, updateShader]
    );

    const handleError = useCallback((err: RendererError | null) => {
        setError(err);
    }, []);

    function handleNameSubmit() {
        setEditingName(false);
        if (nameValue.trim()) updateShader(shaderId, { name: nameValue.trim() });
        else setNameValue(shader?.name ?? "");
    }

    function handleUniformValueChange(name: string, value: number | number[] | boolean) {
        updateUniform(shaderId, name, { value });
    }

    if (!shader) return null;

    const uniforms = shader.uniforms;

    // Build ordered PassInfo list: resolved pre-passes + current shader last
    const passPasses: PassInfo[] = shader.passes
        .map((id) => allShaders.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ source: s!.fragmentSource, uniforms: s!.uniforms }));
    const allPasses: PassInfo[] = [...passPasses, { source: localSource, uniforms }];

    return (
        <div className="h-screen flex flex-col bg-surface-0 overflow-hidden">
            {/* Toolbar */}
            <header className="flex-shrink-0 h-10 flex items-center gap-3 px-4 border-b border-border bg-surface-1">
                <Link to="/">
                    <Logo className="text-xs" />
                </Link>
                <span className="text-border">/</span>

                {editingName ? (
                    <input
                        autoFocus
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={handleNameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleNameSubmit();
                            if (e.key === "Escape") {
                                setEditingName(false);
                                setNameValue(shader.name);
                            }
                        }}
                        className="bg-transparent text-white text-xs border-b border-accent-bright focus:outline-none"
                    />
                ) : (
                    <button
                        onClick={() => setEditingName(true)}
                        title="Click to rename"
                        className="group flex items-center gap-1 text-white text-xs hover:text-accent-bright transition-colors border-b border-dashed border-surface-4 hover:border-accent-bright"
                    >
                        {shader.name}
                        <svg
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 flex-shrink-0"
                            viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                        >
                            <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" />
                        </svg>
                    </button>
                )}

                <div className="flex-1" />

                <button
                    onClick={() => setPublished(shaderId, !shader.published)}
                    className={`publish-btn${shader.published ? " is-published" : ""}`}
                >
                    {shader.published ? "published" : "publish"}
                </button>

                {error && (
                    <span
                        className="text-red-400 text-[10px] max-w-xs truncate"
                        title={error.message}
                    >
                        ⚠ {error.type}: {error.message.split("\n")[0]}
                    </span>
                )}
                {!error && <span className="text-green-500 text-[10px]">● compiled</span>}
                <Link
                    to="/gallery"
                    className="text-surface-4 text-[10px] hover:text-white transition-colors"
                >
                    gallery
                </Link>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-surface-4 text-[10px] hover:text-white transition-colors"
                >
                    sign out
                </button>
            </header>

            {/* Main layout: editor | preview | right panel */}
            <div className="flex-1 flex min-h-0">
                {/* GLSL Editor */}
                <div className="flex-1 min-w-0 border-r border-border">
                    <ShaderEditor value={localSource} onChange={handleSourceChange} />
                </div>

                {/* Preview */}
                <div className="w-[40%] flex-shrink-0 border-r border-border flex flex-col">
                    <ShaderPreview passes={allPasses} onError={handleError} />
                    {error && (
                        <div className="flex-shrink-0 bg-surface-2 border-t border-red-900 max-h-28 overflow-y-auto">
                            <pre className="text-red-400 text-[10px] p-2 whitespace-pre-wrap leading-relaxed">
                                {error.message}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div className="w-80 flex-shrink-0 flex flex-col">
                    {/* Panel tabs */}
                    <div className="flex border-b border-border flex-shrink-0">
                        {(["uniforms", "passes", "export"] as RightPanel[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setRightPanel(p)}
                                className={`flex-1 text-[10px] py-2 uppercase tracking-widest transition-colors border-r border-border last:border-0 ${
                                    rightPanel === p
                                        ? "text-accent-bright bg-surface-2"
                                        : "text-surface-4 hover:text-white"
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 min-h-0">
                        {rightPanel === "uniforms" && (
                            <UniformsPanel
                                uniforms={uniforms}
                                onAdd={(u) => addUniform(shaderId, u)}
                                onUpdate={(name, patch) => updateUniform(shaderId, name, patch)}
                                onRemove={(name) => removeUniform(shaderId, name)}
                                onValueChange={handleUniformValueChange}
                            />
                        )}
                        {rightPanel === "passes" && (
                            <PassesPanel
                                shaderId={shaderId}
                                passes={shader.passes}
                                onAdd={(passId) => addPass(shaderId, passId)}
                                onRemove={(i) => removePass(shaderId, i)}
                                onMoveUp={(i) => reorderPass(shaderId, i, i - 1)}
                                onMoveDown={(i) => reorderPass(shaderId, i, i + 1)}
                            />
                        )}
                        {rightPanel === "export" && <ExportPanel shader={shader} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
