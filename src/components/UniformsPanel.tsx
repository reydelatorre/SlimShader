import { useState } from "react";
import type { ShaderUniform, UniformType } from "../lib/shader-store";

interface Props {
    uniforms: ShaderUniform[];
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
    onUpdate,
    onRemove,
    onValueChange,
}: {
    uniform: ShaderUniform;
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
                        className="w-16 bg-surface-3 text-white text-xs px-1 py-0.5 border border-border text-right"
                    />
                </div>
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
                                className="w-full bg-surface-3 text-white text-xs px-1 py-0.5 border border-border text-right"
                            />
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="group flex flex-col gap-1.5 px-3 py-2 border-b border-border last:border-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-accent-bright text-xs font-medium">{uniform.name}</span>
                    <span className="text-surface-4 text-[10px]">{uniform.type}</span>
                </div>
                <button
                    onClick={() => onRemove(uniform.name)}
                    className="opacity-0 group-hover:opacity-100 text-surface-4 hover:text-red-400 text-[10px] transition-all"
                >
                    remove
                </button>
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
                            className="w-12 bg-surface-3 text-white px-1 py-0.5 border border-border text-right"
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
                            className="w-12 bg-surface-3 text-white px-1 py-0.5 border border-border text-right"
                        />
                    </label>
                </div>
            )}
        </div>
    );
}

export function UniformsPanel({ uniforms, onAdd, onUpdate, onRemove, onValueChange }: Props) {
    const [name, setName] = useState("");
    const [type, setType] = useState<UniformType>("float");
    const [addError, setAddError] = useState("");

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
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        placeholder="name"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setAddError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        className="flex-1 bg-surface-3 text-white text-xs px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                    />
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as UniformType)}
                        className="bg-surface-3 text-white text-xs px-1 py-1 border border-border focus:outline-none focus:border-accent"
                    >
                        {TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleAdd}
                        className="px-2 py-1 bg-accent hover:bg-accent-bright text-white text-xs transition-colors"
                    >
                        +
                    </button>
                </div>
                {addError && <p className="text-red-400 text-[10px] mt-1">{addError}</p>}
            </div>

            <div className="flex-1 overflow-y-auto">
                {uniforms.length === 0 ? (
                    <p className="text-surface-4 text-xs px-3 py-4">
                        No custom uniforms. Built-ins always available: iTime, iResolution, iMouse.
                    </p>
                ) : (
                    uniforms.map((u) => (
                        <UniformRow
                            key={u.name}
                            uniform={u}
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
