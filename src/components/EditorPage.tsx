import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useShaderStore } from "../lib/shader-store";
import { supabase } from "../lib/supabase";
import { Logo } from "./Logo";
import type { RendererError, PassInfo } from "../lib/webgl-renderer";
import type { MeshData } from "../lib/obj-loader";
import { MESH_RAYCAST_STARTER } from "../lib/default-shader";
import { ShaderPreview } from "./ShaderPreview";
import { ShaderEditor } from "./ShaderEditor";
import { UniformsPanel } from "./UniformsPanel";
import { PassesPanel } from "./PassesPanel";
import { ExportPanel } from "./ExportPanel";
import { MeshPanel } from "./MeshPanel";

const MESH_ENABLED = import.meta.env.VITE_ENABLE_MESH === "true";

type RightPanel = "uniforms" | "passes" | "mesh" | "export";

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
    const updatePass = useShaderStore((s) => s.updatePass);

    const [localSource, setLocalSource] = useState(shader?.fragmentSource ?? "");
    const [error, setError] = useState<RendererError | null>(null);
    const [rightPanel, setRightPanel] = useState<RightPanel>("uniforms");
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(shader?.name ?? "");
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [uniformScopeId, setUniformScopeId] = useState(shaderId);

    // Mesh state (ephemeral — not persisted to store)
    const [meshData, setMeshData] = useState<MeshData | null>(null);
    const [meshScale, setMeshScale] = useState(1);
    const [meshRotX, setMeshRotX] = useState(0);
    const [meshRotY, setMeshRotY] = useState(0);
    const [meshRotZ, setMeshRotZ] = useState(0);
    const [wireframe, setWireframe] = useState(0);

    useEffect(() => {
        if (!shader) navigate({ to: "/" });
    }, [shader, navigate]);

    useEffect(() => {
        if (shader) {
            setLocalSource(shader.fragmentSource);
            setNameValue(shader.name);
        }
    }, [shaderId]);

    // Reset scope if the selected pass was removed
    useEffect(() => {
        if (uniformScopeId === shaderId) return;
        const valid = (shader?.passes ?? []).some((p) => p.id === uniformScopeId);
        if (!valid) setUniformScopeId(shaderId);
    }, [shader?.passes, shaderId, uniformScopeId]);

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

    if (!shader) return null;

    const uniforms = shader.uniforms;

    // Build ordered PassInfo list: resolved pre-passes + current shader last.
    // useMemo keeps the reference stable so ShaderPreview's useEffect only fires when content changes.
    const allPasses = useMemo<PassInfo[]>(() => {
        const pre = (shader.passes ?? [])
            .map((p) => {
                const s = allShaders.find((sh) => sh.id === p.id);
                if (!s) return null;
                return { source: s.fragmentSource, uniforms: s.uniforms, blendMode: p.blendMode, opacity: p.opacity };
            })
            .filter(Boolean) as PassInfo[];
        return [...pre, { source: localSource, uniforms, blendMode: shader.blendMode, opacity: shader.blendOpacity }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shader.passes, shader.blendMode, shader.blendOpacity, allShaders, localSource, uniforms]);

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
                    <ShaderPreview
                        passes={allPasses}
                        onError={handleError}
                        meshData={meshData}
                        meshScale={meshScale}
                        meshRotX={meshRotX}
                        meshRotY={meshRotY}
                        meshRotZ={meshRotZ}
                        wireframe={wireframe}
                    />
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
                        {(["uniforms", "passes", ...(MESH_ENABLED ? ["mesh"] : []), "export"] as RightPanel[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setRightPanel(p)}
                                className={`flex-1 text-[10px] py-2 uppercase tracking-widest transition-colors border-r border-border last:border-0 ${
                                    rightPanel === p
                                        ? "text-accent-bright bg-surface-2"
                                        : "text-surface-4 hover:text-white"
                                }`}
                            >
                                {p === "mesh" && meshData ? "mesh ●" : p}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 min-h-0">
                        {rightPanel === "uniforms" && (() => {
                            const isCurrentShader = uniformScopeId === shaderId;
                            const scopeShader = isCurrentShader
                                ? shader
                                : allShaders.find((s) => s.id === uniformScopeId) ?? shader;
                            const passOptions = (shader.passes ?? [])
                                .map((p) => allShaders.find((s) => s.id === p.id))
                                .filter(Boolean) as typeof allShaders;
                            return (
                                <div className="flex flex-col h-full">
                                    {passOptions.length > 0 && (
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0 bg-surface-1">
                                            <span className="text-surface-4 text-[10px] flex-shrink-0">editing</span>
                                            <select
                                                value={uniformScopeId}
                                                onChange={(e) => setUniformScopeId(e.target.value)}
                                                className="flex-1 bg-surface-3 text-white text-[10px] px-2 py-1 border border-border focus:outline-none focus:border-accent"
                                            >
                                                <option value={shaderId}>{shader.name}</option>
                                                {passOptions.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <UniformsPanel
                                        uniforms={scopeShader.uniforms}
                                        fragmentSource={isCurrentShader ? localSource : scopeShader.fragmentSource}
                                        scopeNote={!isCurrentShader ? `editing ${scopeShader.name} — changes affect this shader everywhere it's used` : null}
                                        onAdd={(u) => addUniform(uniformScopeId, u)}
                                        onUpdate={(name, patch) => updateUniform(uniformScopeId, name, patch)}
                                        onRemove={(name) => removeUniform(uniformScopeId, name)}
                                        onValueChange={(name, value) => updateUniform(uniformScopeId, name, { value })}
                                    />
                                </div>
                            );
                        })()}
                        {rightPanel === "passes" && (
                            <PassesPanel
                                shaderId={shaderId}
                                passes={shader.passes}
                                currentBlendMode={shader.blendMode}
                                currentOpacity={shader.blendOpacity}
                                onAdd={(passId) => addPass(shaderId, passId)}
                                onRemove={(i) => removePass(shaderId, i)}
                                onMoveUp={(i) => reorderPass(shaderId, i, i - 1)}
                                onMoveDown={(i) => reorderPass(shaderId, i, i + 1)}
                                onUpdatePass={(i, patch) => updatePass(shaderId, i, patch)}
                                onUpdateCurrentBlend={(blendMode, blendOpacity) => updateShader(shaderId, { blendMode, blendOpacity })}
                            />
                        )}
                        {rightPanel === "mesh" && (
                            <MeshPanel
                                meshData={meshData}
                                meshScale={meshScale}
                                meshRotX={meshRotX}
                                meshRotY={meshRotY}
                                meshRotZ={meshRotZ}
                                wireframe={wireframe}
                                onMeshLoad={(data) => { setMeshData(data); }}
                                onMeshClear={() => setMeshData(null)}
                                onScaleChange={setMeshScale}
                                onRotXChange={setMeshRotX}
                                onRotYChange={setMeshRotY}
                                onRotZChange={setMeshRotZ}
                                onWireframeChange={setWireframe}
                                onInsertStarter={() => handleSourceChange(MESH_RAYCAST_STARTER)}
                            />
                        )}
                        {rightPanel === "export" && <ExportPanel shader={shader} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
