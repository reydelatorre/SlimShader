import { useState } from "react";
import { useShaderStore } from "../lib/shader-store";

interface Props {
    shaderId: string;
    passes: string[];
    onAdd: (passId: string) => void;
    onRemove: (index: number) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
}

export function PassesPanel({ shaderId, passes, onAdd, onRemove, onMoveUp, onMoveDown }: Props) {
    const allShaders = useShaderStore((s) => s.shaders);
    const currentShader = allShaders.find((s) => s.id === shaderId);
    const [selected, setSelected] = useState("");

    // Exclude self and shaders already in the chain
    const available = allShaders.filter((s) => s.id !== shaderId && !passes.includes(s.id));

    function handleAdd() {
        if (!selected) return;
        onAdd(selected);
        setSelected("");
    }

    return (
        <div className="flex flex-col h-full">
            {/* Add pass */}
            <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">Passes</p>
                <div className="flex flex-col gap-1.5">
                    <select
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        className="w-full bg-surface-3 text-white text-xs px-2 py-1 border border-border focus:outline-none focus:border-accent"
                    >
                        <option value="">select shader to add...</option>
                        {available.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAdd}
                        disabled={!selected}
                        className="w-full py-1 bg-accent hover:bg-accent-bright disabled:opacity-40 text-white text-xs transition-colors"
                    >
                        Add Pass
                    </button>
                </div>
            </div>

            {/* Pass list */}
            <div className="flex-1 overflow-y-auto">
                {passes.length === 0 && (
                    <p className="text-surface-4 text-xs px-3 py-4">
                        No passes — this shader runs standalone.
                    </p>
                )}

                {passes.map((passId, i) => {
                    const passShader = allShaders.find((s) => s.id === passId);
                    return (
                        <div key={passId} className="flex items-center gap-2 px-3 py-2 border-b border-border">
                            <span className="text-surface-4 text-[10px] w-4 flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 text-white text-xs truncate">
                                {passShader?.name ?? <span className="text-surface-4 italic">deleted</span>}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => onMoveUp(i)}
                                    disabled={i === 0}
                                    className="text-surface-4 hover:text-white text-xs disabled:opacity-30 cursor-pointer px-1"
                                >
                                    ↑
                                </button>
                                <button
                                    onClick={() => onMoveDown(i)}
                                    disabled={i === passes.length - 1}
                                    className="text-surface-4 hover:text-white text-xs disabled:opacity-30 cursor-pointer px-1"
                                >
                                    ↓
                                </button>
                                <button
                                    onClick={() => onRemove(i)}
                                    className="cursor-pointer text-[10px] px-1.5 py-0.5 bg-surface-3 hover:bg-red-900 text-surface-4 hover:text-red-400 border border-border hover:border-red-800 transition-all"
                                >
                                    remove
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Current shader — always the final pass */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-2">
                    <span className="text-surface-4 text-[10px] w-4 flex-shrink-0">{passes.length + 1}</span>
                    <span className="flex-1 text-accent-bright text-xs truncate">{currentShader?.name}</span>
                    <span className="text-surface-4 text-[10px] flex-shrink-0">current</span>
                </div>
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-border">
                <p className="text-[10px] text-surface-4">
                    Each pass receives the previous output as{" "}
                    <span className="text-white">iChannel0</span>
                </p>
            </div>
        </div>
    );
}
