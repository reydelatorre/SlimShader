import { useState } from "react";
import type { ShaderUniform, UniformType } from "../lib/shader-store";
import { ColorPicker } from "./ColorPicker";

interface Props {
    uniforms: ShaderUniform[];
    fragmentSource: string;
    scopeNote?: string | null;
    onAdd: (u: ShaderUniform) => void;
    onUpdate: (name: string, patch: Partial<ShaderUniform>) => void;
    onRemove: (name: string) => void;
    onValueChange: (name: string, value: number | number[] | boolean) => void;
}

const TYPE_OPTIONS: UniformType[] = ["float", "int", "bool", "vec2", "vec3", "vec4"];

function defaultValue(type: UniformType): number | number[] | boolean {
    switch (type) {
        case "float":
        case "int":
            return 0;
        case "bool":
            return false;
        case "vec2":
            return [0, 0];
        case "vec3":
            return [0, 0, 0];
        case "vec4":
            return [0, 0, 0, 1];
        default:
            return 0;
    }
}

function vecComponents(type: UniformType): string[] {
    switch (type) {
        case "vec2":
            return ["x", "y"];
        case "vec3":
            return ["x", "y", "z"];
        case "vec4":
            return ["x", "y", "z", "w"];
        default:
            return [];
    }
}

function UniformRow({
    uniform,
    fragmentSource,
    pendingRemove,
    setPendingRemove,
    onUpdate,
    onRemove,
    onValueChange,
}: {
    uniform: ShaderUniform;
    fragmentSource: string;
    pendingRemove: string | null;
    setPendingRemove: (name: string | null) => void;
    onUpdate: (name: string, patch: Partial<ShaderUniform>) => void;
    onRemove: (name: string) => void;
    onValueChange: (name: string, value: number | number[] | boolean) => void;
}) {
    const components = vecComponents(uniform.type);

    function renderControl() {
        if (uniform.type === "bool") {
            return (
                <input
                    type="checkbox"
                    checked={uniform.value as boolean}
                    onChange={(e) => onValueChange(uniform.name, e.target.checked)}
                    className="accent-accent"
                />
            );
        }
        if (uniform.type === "float" || uniform.type === "int") {
            const v = uniform.value as number;
            const min = uniform.min ?? 0;
            const max = uniform.max ?? 1;
            return (
                <div className="flex items-center gap-2 flex-1">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={uniform.step ?? (uniform.type === "int" ? 1 : 0.001)}
                        value={v}
                        onChange={(e) => onValueChange(uniform.name, parseFloat(e.target.value))}
                        className="flex-1 accent-accent-bright h-1"
                    />
                    <input
                        type="number"
                        value={v}
                        step={uniform.step ?? (uniform.type === "int" ? 1 : 0.01)}
                        onChange={(e) => onValueChange(uniform.name, parseFloat(e.target.value))}
                        className="w-16 bg-surface-3 text-white text-xs px-2 py-1.5 border border-border text-right"
                    />
                </div>
            );
        }
        if ((uniform.type === "vec3" || uniform.type === "vec4") && uniform.isColor) {
            return (
                <ColorPicker
                    value={uniform.value as number[]}
                    onChange={(v) => onValueChange(uniform.name, v)}
                />
            );
        }
        if (components.length > 0) {
            const arr = uniform.value as number[];
            return (
                <div className="flex gap-1 flex-1">
                    {components.map((label, i) => (
                        <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-surface-4 text-[10px]">{label}</span>
                            <input
                                type="number"
                                value={arr[i] ?? 0}
                                step={0.01}
                                onChange={(e) => {
                                    const next = [...arr];
                                    next[i] = parseFloat(e.target.value);
                                    onValueChange(uniform.name, next);
                                }}
                                className="w-full bg-surface-3 text-white text-xs px-2 py-1.5 border border-border text-right"
                            />
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border last:border-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-accent-bright text-xs font-medium">{uniform.name}</span>
                    <span className="text-surface-4 text-[10px]">{uniform.type}</span>
                </div>
                <div className="flex items-center gap-2">
                    {(uniform.type === "vec3" || uniform.type === "vec4") && (
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!uniform.isColor}
                                onChange={(e) => onUpdate(uniform.name, { isColor: e.target.checked })}
                                className="accent-accent"
                            />
                            <span className="text-surface-4 text-[10px]">color</span>
                        </label>
                    )}
                    {pendingRemove === uniform.name ? (
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-yellow-400">still in shader —</span>
                            <button
                                onClick={() => { onRemove(uniform.name); setPendingRemove(null); }}
                                className="cursor-pointer text-[10px] px-1.5 py-0.5 bg-red-900 text-red-400 border border-red-800"
                            >confirm</button>
                            <button
                                onClick={() => setPendingRemove(null)}
                                className="cursor-pointer text-[10px] px-1.5 py-0.5 bg-surface-3 text-surface-4 border border-border"
                            >cancel</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                const used = new RegExp(`\\b${uniform.name}\\b`).test(fragmentSource);
                                if (used) {
                                    setPendingRemove(uniform.name);
                                } else {
                                    onRemove(uniform.name);
                                }
                            }}
                            className="cursor-pointer text-[10px] px-1.5 py-0.5 bg-surface-3 hover:bg-red-900 text-surface-4 hover:text-red-400 border border-border hover:border-red-800 transition-all"
                        >
                            remove
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">{renderControl()}</div>
            {(uniform.type === "float" || uniform.type === "int") && (
                <div className="flex items-center gap-2 text-[10px] text-surface-4">
                    <label className="flex items-center gap-1">
                        min
                        <input
                            type="number"
                            value={uniform.min ?? 0}
                            step={0.1}
                            onChange={(e) =>
                                onUpdate(uniform.name, { min: parseFloat(e.target.value) })
                            }
                            className="w-12 bg-surface-3 text-white px-2 py-1.5 border border-border text-right"
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        max
                        <input
                            type="number"
                            value={uniform.max ?? 1}
                            step={0.1}
                            onChange={(e) =>
                                onUpdate(uniform.name, { max: parseFloat(e.target.value) })
                            }
                            className="w-12 bg-surface-3 text-white px-2 py-1.5 border border-border text-right"
                        />
                    </label>
                </div>
            )}
        </div>
    );
}

export function UniformsPanel({ uniforms, fragmentSource, scopeNote, onAdd, onUpdate, onRemove, onValueChange }: Props) {
    const [name, setName] = useState("");
    const [type, setType] = useState<UniformType>("float");
    const [addError, setAddError] = useState("");
    const [pendingRemove, setPendingRemove] = useState<string | null>(null);

    function handleAdd() {
        const trimmed = name.trim();
        if (!trimmed) return setAddError("Name required");
        if (!/^[a-zA-Z_]\w*$/.test(trimmed)) return setAddError("Invalid identifier");
        if (uniforms.some((u) => u.name === trimmed)) return setAddError("Already exists");
        if (["iTime", "iResolution", "iMouse"].includes(trimmed))
            return setAddError("Reserved name");
        onAdd({ name: trimmed, type, value: defaultValue(type), min: 0, max: 1 });
        setName("");
        setAddError("");
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">
                    Uniforms
                </p>
                <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            placeholder="new uniform name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setAddError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            className="flex-1 min-w-0 bg-surface-3 text-white text-xs px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                        />
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as UniformType)}
                            className="flex-shrink-0 bg-surface-3 text-white text-xs px-1 py-1 border border-border focus:outline-none focus:border-accent"
                        >
                            {TYPE_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleAdd}
                        className="w-full py-1 bg-accent hover:bg-accent-bright text-white text-xs transition-colors"
                    >
                        Add Uniform
                    </button>
                </div>
                {addError && <p className="text-red-400 text-[10px] mt-1">{addError}</p>}
            </div>

            <div className="flex-1 overflow-y-auto">
                {scopeNote && (
                    <div className="px-3 py-2 border-b border-border bg-surface-2 flex items-start gap-2">
                        <span className="text-yellow-400 text-[10px] flex-shrink-0 mt-px">⚠</span>
                        <p className="text-surface-4 text-[10px] leading-relaxed">{scopeNote}</p>
                    </div>
                )}
                {uniforms.length === 0 ? (
                    <p className="text-surface-4 text-xs px-3 py-4">
                        No custom uniforms. Built-ins always available: iTime, iResolution, iMouse.
                    </p>
                ) : (
                    uniforms.map((u) => (
                        <UniformRow
                            key={u.name}
                            uniform={u}
                            fragmentSource={fragmentSource}
                            pendingRemove={pendingRemove}
                            setPendingRemove={setPendingRemove}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onValueChange={onValueChange}
                        />
                    ))
                )}
            </div>

            <div className="px-3 py-2 border-t border-border">
                <p className="text-[10px] text-surface-4">
                    Built-in: <span className="text-white">iTime</span>{" "}
                    <span className="text-white">iResolution</span>{" "}
                    <span className="text-white">iMouse</span>
                </p>
            </div>
        </div>
    );
}
