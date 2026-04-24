import { useState } from "react";
import type { ShaderUniform, UniformType } from "../lib/shader-store";
import { ColorPicker } from "./ColorPicker";
import { ScrubInput } from "./ScrubInput";
import { XYPad } from "./XYPad";
import { GradientRampEditor } from "./GradientRampEditor";

interface Props {
    uniforms: ShaderUniform[];
    fragmentSource: string;
    scopeNote?: string | null;
    onAdd: (u: ShaderUniform) => void;
    onUpdate: (name: string, patch: Partial<ShaderUniform>) => void;
    onRemove: (name: string) => void;
    onValueChange: (name: string, value: number | number[] | boolean) => void;
}

const SCALAR_TYPES: UniformType[] = ["float", "int", "bool", "vec2", "vec3", "vec4", "select", "ramp"];

function defaultValue(type: UniformType): number | number[] | boolean {
    switch (type) {
        case "bool": return false;
        case "vec2": return [0, 0];
        case "vec3": return [0, 0, 0];
        case "vec4": return [0, 0, 0, 1];
        default: return 0;
    }
}

function vecLabels(type: UniformType): string[] {
    switch (type) {
        case "vec2": return ["x", "y"];
        case "vec3": return ["x", "y", "z"];
        case "vec4": return ["x", "y", "z", "w"];
        default: return [];
    }
}

// ── Single uniform row ─────────────────────────────────────────────────────

function UniformRow({
    uniform,
    allUniforms,
    fragmentSource,
    pendingRemove,
    setPendingRemove,
    onUpdate,
    onRemove,
    onValueChange,
}: {
    uniform: ShaderUniform;
    allUniforms: ShaderUniform[];
    fragmentSource: string;
    pendingRemove: string | null;
    setPendingRemove: (n: string | null) => void;
    onUpdate: (name: string, patch: Partial<ShaderUniform>) => void;
    onRemove: (name: string) => void;
    onValueChange: (name: string, value: number | number[] | boolean) => void;
}) {
    const [showOptions, setShowOptions] = useState(false);
    const [showCondition, setShowCondition] = useState(false);
    const [newOptLabel, setNewOptLabel] = useState("");
    const [newOptValue, setNewOptValue] = useState("0");

    const isScalar = uniform.type === "float" || uniform.type === "int";
    const isVec = ["vec2", "vec3", "vec4"].includes(uniform.type);
    const labels = vecLabels(uniform.type);
    const displayName = uniform.label || uniform.name;

    function renderControl() {
        // Bool
        if (uniform.type === "bool") {
            return (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                        onClick={() => onValueChange(uniform.name, !(uniform.value as boolean))}
                        className={`relative w-8 h-4 rounded-full transition-colors ${
                            uniform.value ? "bg-accent" : "bg-surface-3 border border-border"
                        }`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            uniform.value ? "translate-x-4" : "translate-x-0.5"
                        }`} />
                    </div>
                    <span className="text-surface-4 text-[10px]">{uniform.value ? "true" : "false"}</span>
                </label>
            );
        }

        // Color picker (vec3/vec4 with isColor)
        if ((uniform.type === "vec3" || uniform.type === "vec4") && uniform.isColor) {
            return (
                <ColorPicker
                    value={uniform.value as number[]}
                    onChange={(v) => onValueChange(uniform.name, v)}
                />
            );
        }

        // XY Pad (vec2 with isXYPad)
        if (uniform.type === "vec2" && uniform.isXYPad) {
            const arr = uniform.value as number[];
            return (
                <XYPad
                    value={[arr[0] ?? 0, arr[1] ?? 0]}
                    min={uniform.min ?? -1}
                    max={uniform.max ?? 1}
                    step={uniform.step}
                    onChange={(v) => onValueChange(uniform.name, v)}
                />
            );
        }

        // Vec components (individual scrub inputs)
        if (isVec) {
            const arr = uniform.value as number[];
            return (
                <div className="flex gap-1 flex-1">
                    {labels.map((lbl, i) => (
                        <div key={lbl} className="flex-1 flex flex-col gap-0.5">
                            <span className="text-surface-4 text-[9px] text-center">{lbl}</span>
                            <ScrubInput
                                value={arr[i] ?? 0}
                                min={uniform.min}
                                max={uniform.max}
                                step={uniform.step ?? 0.01}
                                onChange={(v) => {
                                    const next = [...arr];
                                    next[i] = v;
                                    onValueChange(uniform.name, next);
                                }}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        // Select
        if (uniform.type === "select") {
            const opts = uniform.options ?? [];
            const current = uniform.value as number;
            return (
                <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex flex-wrap gap-1">
                        {opts.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => onValueChange(uniform.name, opt.value)}
                                className={`px-2 py-1 text-[10px] border transition-colors ${
                                    current === opt.value
                                        ? "border-accent-bright text-accent-bright bg-accent/10"
                                        : "border-border text-surface-4 hover:border-surface-4 hover:text-white"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {/* Options editor */}
                    <button
                        onClick={() => setShowOptions((v) => !v)}
                        className="text-[9px] text-surface-4 hover:text-white text-left transition-colors"
                    >
                        {showOptions ? "▲ hide options" : "▼ edit options"}
                    </button>
                    {showOptions && (
                        <div className="flex flex-col gap-1 border border-border p-2 bg-surface-2">
                            {opts.map((opt, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <input
                                        value={opt.label}
                                        onChange={(e) => {
                                            const next = [...opts];
                                            next[i] = { ...next[i], label: e.target.value };
                                            onUpdate(uniform.name, { options: next });
                                        }}
                                        className="flex-1 bg-surface-3 border border-border text-white text-[10px] px-1.5 py-1 focus:outline-none focus:border-accent"
                                        placeholder="label"
                                    />
                                    <input
                                        type="number"
                                        value={opt.value}
                                        onChange={(e) => {
                                            const next = [...opts];
                                            next[i] = { ...next[i], value: parseFloat(e.target.value) };
                                            onUpdate(uniform.name, { options: next });
                                        }}
                                        className="w-12 bg-surface-3 border border-border text-white text-[10px] px-1.5 py-1 text-right focus:outline-none focus:border-accent"
                                    />
                                    <button
                                        onClick={() => onUpdate(uniform.name, { options: opts.filter((_, j) => j !== i) })}
                                        className="text-surface-4 hover:text-red-400 text-[10px] px-1"
                                    >×</button>
                                </div>
                            ))}
                            <div className="flex items-center gap-1 mt-1">
                                <input
                                    value={newOptLabel}
                                    onChange={(e) => setNewOptLabel(e.target.value)}
                                    placeholder="label"
                                    className="flex-1 bg-surface-3 border border-border text-white text-[10px] px-1.5 py-1 focus:outline-none focus:border-accent placeholder:text-surface-4"
                                />
                                <input
                                    value={newOptValue}
                                    onChange={(e) => setNewOptValue(e.target.value)}
                                    className="w-12 bg-surface-3 border border-border text-white text-[10px] px-1.5 py-1 text-right focus:outline-none focus:border-accent"
                                />
                                <button
                                    onClick={() => {
                                        if (!newOptLabel.trim()) return;
                                        onUpdate(uniform.name, {
                                            options: [...opts, { label: newOptLabel.trim(), value: parseFloat(newOptValue) || 0 }],
                                        });
                                        setNewOptLabel("");
                                        setNewOptValue(String(opts.length));
                                    }}
                                    className="text-[10px] px-2 py-1 bg-accent hover:bg-accent-bright text-white transition-colors"
                                >+</button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Gradient Ramp
        if (uniform.type === "ramp") {
            const stops = uniform.stops ?? [
                { position: 0, color: [0, 0, 0] as [number, number, number] },
                { position: 1, color: [1, 1, 1] as [number, number, number] },
            ];
            return (
                <GradientRampEditor
                    stops={stops}
                    onChange={(next) => onUpdate(uniform.name, { stops: next })}
                />
            );
        }

        // Float / Int — scrub input
        if (isScalar) {
            return (
                <ScrubInput
                    value={uniform.value as number}
                    min={uniform.min ?? 0}
                    max={uniform.max ?? 1}
                    step={uniform.step ?? (uniform.type === "int" ? 1 : undefined)}
                    isInt={uniform.type === "int"}
                    onChange={(v) => onValueChange(uniform.name, v)}
                    className="flex-1"
                />
            );
        }

        return null;
    }

    return (
        <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-border last:border-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-white text-xs font-medium truncate">{displayName}</span>
                        <span className="text-surface-4 text-[9px] shrink-0">{uniform.type}</span>
                        {uniform.label && (
                            <span className="text-surface-4/60 text-[9px] italic truncate">{uniform.name}</span>
                        )}
                    </div>
                    {uniform.description && (
                        <p className="text-surface-4 text-[10px] leading-relaxed">{uniform.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Color toggle */}
                    {(uniform.type === "vec3" || uniform.type === "vec4") && (
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!uniform.isColor}
                                onChange={(e) => onUpdate(uniform.name, { isColor: e.target.checked })}
                                className="accent-accent w-3 h-3"
                            />
                            <span className="text-surface-4 text-[9px]">color</span>
                        </label>
                    )}
                    {/* XY Pad toggle */}
                    {uniform.type === "vec2" && (
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!uniform.isXYPad}
                                onChange={(e) => onUpdate(uniform.name, { isXYPad: e.target.checked })}
                                className="accent-accent w-3 h-3"
                            />
                            <span className="text-surface-4 text-[9px]">xy pad</span>
                        </label>
                    )}
                    {/* Condition toggle */}
                    <button
                        onClick={() => setShowCondition((v) => !v)}
                        title="Conditional visibility"
                        className={`text-[9px] px-1 py-0.5 border transition-colors ${
                            uniform.visibleWhen
                                ? "border-accent text-accent"
                                : "border-border text-surface-4 hover:text-white"
                        }`}
                    >if</button>
                    {/* Remove */}
                    {pendingRemove === uniform.name ? (
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-yellow-400">still in shader —</span>
                            <button
                                onClick={() => { onRemove(uniform.name); setPendingRemove(null); }}
                                className="text-[9px] px-1.5 py-0.5 bg-red-900 text-red-400 border border-red-800"
                            >confirm</button>
                            <button
                                onClick={() => setPendingRemove(null)}
                                className="text-[9px] px-1.5 py-0.5 bg-surface-3 text-surface-4 border border-border"
                            >cancel</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                const used = new RegExp(`\\b${uniform.name}\\b`).test(fragmentSource);
                                if (used) setPendingRemove(uniform.name);
                                else onRemove(uniform.name);
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-surface-3 hover:bg-red-900 text-surface-4 hover:text-red-400 border border-border hover:border-red-800 transition-all"
                        >×</button>
                    )}
                </div>
            </div>

            {/* Control */}
            <div className="flex items-center gap-2">{renderControl()}</div>

            {/* Range config for scalar types */}
            {isScalar && uniform.type !== "select" && (
                <div className="flex items-center gap-3 text-[9px] text-surface-4">
                    <label className="flex items-center gap-1">
                        min
                        <input
                            type="number"
                            value={uniform.min ?? 0}
                            step={0.1}
                            onChange={(e) => onUpdate(uniform.name, { min: parseFloat(e.target.value) })}
                            className="w-12 bg-surface-3 text-white px-1.5 py-1 border border-border text-right"
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        max
                        <input
                            type="number"
                            value={uniform.max ?? 1}
                            step={0.1}
                            onChange={(e) => onUpdate(uniform.name, { max: parseFloat(e.target.value) })}
                            className="w-12 bg-surface-3 text-white px-1.5 py-1 border border-border text-right"
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        step
                        <input
                            type="number"
                            value={uniform.step ?? ""}
                            step={0.001}
                            placeholder="auto"
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                onUpdate(uniform.name, { step: isNaN(v) ? undefined : v });
                            }}
                            className="w-14 bg-surface-3 text-white px-1.5 py-1 border border-border text-right placeholder:text-surface-4"
                        />
                    </label>
                </div>
            )}
            {/* Range config for vec2 xy pad */}
            {uniform.type === "vec2" && uniform.isXYPad && (
                <div className="flex items-center gap-3 text-[9px] text-surface-4">
                    <label className="flex items-center gap-1">
                        min
                        <input type="number" value={uniform.min ?? -1} step={0.1}
                            onChange={(e) => onUpdate(uniform.name, { min: parseFloat(e.target.value) })}
                            className="w-12 bg-surface-3 text-white px-1.5 py-1 border border-border text-right"
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        max
                        <input type="number" value={uniform.max ?? 1} step={0.1}
                            onChange={(e) => onUpdate(uniform.name, { max: parseFloat(e.target.value) })}
                            className="w-12 bg-surface-3 text-white px-1.5 py-1 border border-border text-right"
                        />
                    </label>
                </div>
            )}
            {/* Conditional visibility editor */}
            {showCondition && (
                <div className="flex flex-col gap-1 border border-border p-2 bg-surface-2 text-[9px] text-surface-4">
                    <p className="uppercase tracking-widest">Show when</p>
                    <div className="flex items-center gap-1">
                        <select
                            value={uniform.visibleWhen?.key ?? ""}
                            onChange={(e) => {
                                const key = e.target.value;
                                if (!key) onUpdate(uniform.name, { visibleWhen: undefined });
                                else onUpdate(uniform.name, { visibleWhen: { key, equals: uniform.visibleWhen?.equals ?? 1 } });
                            }}
                            className="flex-1 bg-surface-3 text-white text-[9px] px-1.5 py-1 border border-border focus:outline-none"
                        >
                            <option value="">— always visible —</option>
                            {allUniforms.filter((u) => u.name !== uniform.name).map((u) => (
                                <option key={u.name} value={u.name}>{u.label ?? u.name}</option>
                            ))}
                        </select>
                        {uniform.visibleWhen && (
                            <>
                                <span>=</span>
                                <input
                                    type="number"
                                    value={uniform.visibleWhen.equals as number}
                                    step={1}
                                    onChange={(e) => onUpdate(uniform.name, {
                                        visibleWhen: { key: uniform.visibleWhen!.key, equals: parseFloat(e.target.value) },
                                    })}
                                    className="w-14 bg-surface-3 text-white px-1.5 py-1 border border-border text-right"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function isVisible(uniform: ShaderUniform, all: ShaderUniform[]): boolean {
    if (!uniform.visibleWhen) return true;
    const dep = all.find((u) => u.name === uniform.visibleWhen!.key);
    if (!dep) return true;
    return dep.value === uniform.visibleWhen.equals;
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function UniformsPanel({ uniforms, fragmentSource, scopeNote, onAdd, onUpdate, onRemove, onValueChange }: Props) {
    const [name, setName] = useState("");
    const [type, setType] = useState<UniformType>("float");
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [group, setGroup] = useState("");
    const [addError, setAddError] = useState("");
    const [pendingRemove, setPendingRemove] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    function toggleGroup(g: string) {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(g)) next.delete(g);
            else next.add(g);
            return next;
        });
    }

    function handleAdd() {
        const trimmed = name.trim();
        if (!trimmed) return setAddError("Name required");
        if (!/^[a-zA-Z_]\w*$/.test(trimmed)) return setAddError("Invalid identifier");
        if (uniforms.some((u) => u.name === trimmed)) return setAddError("Already exists");
        if (["iTime", "iResolution", "iMouse"].includes(trimmed)) return setAddError("Reserved name");

        const base: ShaderUniform = {
            name: trimmed,
            type,
            value: defaultValue(type),
            min: type === "vec2" ? -1 : 0,
            max: 1,
            ...(label.trim() ? { label: label.trim() } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(group.trim() ? { group: group.trim() } : {}),
            ...(type === "select" ? { options: [{ label: "Off", value: 0 }, { label: "On", value: 1 }] } : {}),
            ...(type === "ramp" ? { stops: [{ position: 0, color: [0, 0, 0] as [number, number, number] }, { position: 1, color: [1, 1, 1] as [number, number, number] }] } : {}),
        };

        onAdd(base);
        setName("");
        setLabel("");
        setDescription("");
        setAddError("");
    }

    // Group uniforms: ungrouped first, then by group name
    const ungrouped = uniforms.filter((u) => !u.group);
    const groupNames = [...new Set(uniforms.filter((u) => u.group).map((u) => u.group!))]
        .sort((a, b) => a.localeCompare(b));

    return (
        <div className="flex flex-col h-full">
            {/* Add form */}
            <div className="px-3 py-2 border-b border-border flex-shrink-0">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">Uniforms</p>
                <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            placeholder="name (GLSL)"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setAddError(""); }}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            className="flex-1 min-w-0 bg-surface-3 text-white text-xs px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                        />
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as UniformType)}
                            className="shrink-0 bg-surface-3 text-white text-xs px-1 py-1 border border-border focus:outline-none focus:border-accent"
                        >
                            {SCALAR_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            placeholder="display label (optional)"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="flex-1 min-w-0 bg-surface-3 text-white text-[10px] px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                        />
                        <input
                            type="text"
                            placeholder="group"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                            className="w-20 bg-surface-3 text-white text-[10px] px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-surface-3 text-white text-[10px] px-2 py-1 border border-border placeholder:text-surface-4 focus:outline-none focus:border-accent"
                    />
                    <button
                        onClick={handleAdd}
                        className="w-full py-1 bg-accent hover:bg-accent-bright text-white text-xs transition-colors"
                    >
                        Add Uniform
                    </button>
                </div>
                {addError && <p className="text-red-400 text-[10px] mt-1">{addError}</p>}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {scopeNote && (
                    <div className="px-3 py-2 border-b border-border bg-surface-2 flex items-start gap-2">
                        <span className="text-yellow-400 text-[10px] shrink-0 mt-px">⚠</span>
                        <p className="text-surface-4 text-[10px] leading-relaxed">{scopeNote}</p>
                    </div>
                )}

                {uniforms.length === 0 ? (
                    <p className="text-surface-4 text-xs px-3 py-4">
                        No uniforms. Built-ins: <span className="text-white">iTime</span>{" "}
                        <span className="text-white">iResolution</span>{" "}
                        <span className="text-white">iMouse</span>
                    </p>
                ) : (
                    <>
                        {/* Ungrouped */}
                        {ungrouped.filter((u) => isVisible(u, uniforms)).map((u) => (
                            <UniformRow
                                key={u.name}
                                uniform={u}
                                allUniforms={uniforms}
                                fragmentSource={fragmentSource}
                                pendingRemove={pendingRemove}
                                setPendingRemove={setPendingRemove}
                                onUpdate={onUpdate}
                                onRemove={onRemove}
                                onValueChange={onValueChange}
                            />
                        ))}

                        {/* Groups */}
                        {groupNames.map((g) => {
                            const members = uniforms.filter((u) => u.group === g && isVisible(u, uniforms));
                            const collapsed = collapsedGroups.has(g);
                            return (
                                <div key={g}>
                                    <button
                                        onClick={() => toggleGroup(g)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border text-[10px] text-surface-4 hover:text-white uppercase tracking-widest transition-colors"
                                    >
                                        <span>{g}</span>
                                        <span>{collapsed ? "▶" : "▼"}</span>
                                    </button>
                                    {!collapsed && members.map((u) => (
                                        <UniformRow
                                            key={u.name}
                                            uniform={u}
                                            allUniforms={uniforms}
                                            fragmentSource={fragmentSource}
                                            pendingRemove={pendingRemove}
                                            setPendingRemove={setPendingRemove}
                                            onUpdate={onUpdate}
                                            onRemove={onRemove}
                                            onValueChange={onValueChange}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            <div className="px-3 py-2 border-t border-border shrink-0">
                <p className="text-[10px] text-surface-4">
                    Built-in:{" "}
                    <span className="text-white">iTime</span>{" "}
                    <span className="text-white">iResolution</span>{" "}
                    <span className="text-white">iMouse</span>
                </p>
            </div>
        </div>
    );
}
