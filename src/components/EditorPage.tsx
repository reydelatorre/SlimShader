import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useShaderStore } from "../lib/shader-store";
import type { RendererError } from "../lib/webgl-renderer";
import { ShaderPreview } from "./ShaderPreview";
import { ShaderEditor } from "./ShaderEditor";
import { UniformsPanel } from "./UniformsPanel";
import { ExportPanel } from "./ExportPanel";

type RightPanel = "uniforms" | "export";

export function EditorPage() {
    const { shaderId } = useParams({ from: "/editor/$shaderId" });
    const navigate = useNavigate();
    const shader = useShaderStore((s) => s.shaders.find((sh) => sh.id === shaderId));
    const updateShader = useShaderStore((s) => s.updateShader);
    const addUniform = useShaderStore((s) => s.addUniform);
    const updateUniform = useShaderStore((s) => s.updateUniform);
    const removeUniform = useShaderStore((s) => s.removeUniform);

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

    return (
        <div className="h-screen flex flex-col bg-surface-0 overflow-hidden">
            {/* Toolbar */}
            <header className="flex-shrink-0 h-10 flex items-center gap-3 px-4 border-b border-border bg-surface-1">
                <Link
                    to="/"
                    className="text-accent-bright font-bold text-xs tracking-wider hover:text-white transition-colors"
                >
                    SLIM<span className="text-white">SHADER</span>
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
                        className="text-white text-xs hover:text-accent-bright transition-colors"
                    >
                        {shader.name}
                    </button>
                )}

                <div className="flex-1" />

                {error && (
                    <span className="text-red-400 text-[10px] max-w-xs truncate" title={error.message}>
                        ⚠ {error.type}: {error.message.split("\n")[0]}
                    </span>
                )}
                {!error && (
                    <span className="text-green-500 text-[10px]">● compiled</span>
                )}
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
                        fragmentSource={localSource}
                        uniforms={uniforms}
                        onError={handleError}
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
                <div className="w-64 flex-shrink-0 flex flex-col">
                    {/* Panel tabs */}
                    <div className="flex border-b border-border flex-shrink-0">
                        {(["uniforms", "export"] as RightPanel[]).map((p) => (
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
                        {rightPanel === "export" && <ExportPanel shader={shader} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
