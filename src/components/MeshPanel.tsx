import { useRef, useState } from "react";
import { loadOBJ, type MeshData } from "../lib/obj-loader";

interface Props {
    meshData: MeshData | null;
    meshScale: number;
    meshRotX: number;
    meshRotY: number;
    meshRotZ: number;
    wireframe: number;
    onMeshLoad: (data: MeshData) => void;
    onMeshClear: () => void;
    onScaleChange: (v: number) => void;
    onRotXChange: (v: number) => void;
    onRotYChange: (v: number) => void;
    onRotZChange: (v: number) => void;
    onWireframeChange: (v: number) => void;
    onInsertStarter: () => void;
}

const RAD = Math.PI / 180;

export function MeshPanel({
    meshData, meshScale, meshRotX, meshRotY, meshRotZ, wireframe,
    onMeshLoad, onMeshClear,
    onScaleChange, onRotXChange, onRotYChange, onRotZChange, onWireframeChange,
    onInsertStarter,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    function processFile(file: File) {
        if (!file.name.endsWith(".obj")) {
            setLoadError("Only .obj files are supported.");
            return;
        }
        setLoadError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const result = loadOBJ(text, file.name.replace(/\.obj$/i, ""));
            if (typeof result === "string") {
                setLoadError(result);
            } else {
                onMeshLoad(result);
            }
        };
        reader.readAsText(file);
    }

    function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }

    const degToRad = (deg: number) => deg * RAD;

    return (
        <div className="h-full overflow-y-auto flex flex-col gap-4 p-3 text-xs text-white">
            {/* Drop zone */}
            <div
                className={`border border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                    dragging ? "border-accent-bright bg-surface-2" : "border-border hover:border-surface-4"
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-surface-4">
                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-surface-4 text-[10px] text-center leading-relaxed">
                    {meshData ? "Replace OBJ" : "Drop .obj or click to browse"}
                </p>
                <input ref={fileRef} type="file" accept=".obj" className="hidden" onChange={onFileInput} />
            </div>

            {loadError && (
                <p className="text-red-400 text-[10px] leading-relaxed">{loadError}</p>
            )}

            {/* Mesh info */}
            {meshData && (
                <div className="bg-surface-2 border border-border p-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-accent-bright font-medium truncate">{meshData.name}</span>
                        <button
                            onClick={onMeshClear}
                            className="text-surface-4 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                            title="Remove mesh"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="text-surface-4 text-[10px]">{meshData.numTris.toLocaleString()} triangles</p>
                    <p className="text-surface-4 text-[10px]">
                        range {meshData.meshRange.toFixed(3)} · min ({meshData.meshMin.map(v => v.toFixed(2)).join(", ")})
                    </p>
                </div>
            )}

            {/* Transform controls — always visible */}
            <div className="flex flex-col gap-3">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest">Transform</p>

                <SliderRow
                    label="Scale"
                    value={meshScale}
                    min={0.01} max={5} step={0.01}
                    display={meshScale.toFixed(2)}
                    onChange={onScaleChange}
                />
                <SliderRow
                    label="Rot X"
                    value={Math.round(meshRotX / RAD)}
                    min={-180} max={180} step={1}
                    display={`${Math.round(meshRotX / RAD)}°`}
                    onChange={(deg) => onRotXChange(degToRad(deg))}
                />
                <SliderRow
                    label="Rot Y"
                    value={Math.round(meshRotY / RAD)}
                    min={-180} max={180} step={1}
                    display={`${Math.round(meshRotY / RAD)}°`}
                    onChange={(deg) => onRotYChange(degToRad(deg))}
                />
                <SliderRow
                    label="Rot Z"
                    value={Math.round(meshRotZ / RAD)}
                    min={-180} max={180} step={1}
                    display={`${Math.round(meshRotZ / RAD)}°`}
                    onChange={(deg) => onRotZChange(degToRad(deg))}
                />
            </div>

            {/* Wireframe */}
            <div className="flex flex-col gap-2">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest">View mode (uWireframe)</p>
                <div className="flex gap-2">
                    {([["Solid", 0], ["Wire", 1], ["Hybrid", 2]] as [string, number][]).map(([label, val]) => (
                        <button
                            key={val}
                            onClick={() => onWireframeChange(val)}
                            className={`flex-1 py-1.5 text-[10px] border transition-colors ${
                                wireframe === val
                                    ? "border-accent-bright text-accent-bright bg-surface-2"
                                    : "border-border text-surface-4 hover:text-white"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Starter shader */}
            {meshData && (
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] text-surface-4 uppercase tracking-widest">Starter</p>
                    <button
                        onClick={onInsertStarter}
                        className="w-full py-2 text-[10px] border border-border text-surface-4 hover:text-white hover:border-surface-4 transition-colors text-left px-3"
                    >
                        Insert raycast shader →
                    </button>
                    <p className="text-[10px] text-surface-4 leading-relaxed">
                        Replaces the current shader with a Möller–Trumbore raycast template. Use the sliders above to frame your mesh.
                    </p>
                </div>
            )}
        </div>
    );
}

function SliderRow({
    label, value, min, max, step, display, onChange,
}: {
    label: string;
    value: number;
    min: number; max: number; step: number;
    display: string;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
                <span className="text-surface-4 text-[10px]">{label}</span>
                <span className="text-white text-[10px] font-mono">{display}</span>
            </div>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-accent-bright h-0.5"
            />
        </div>
    );
}
