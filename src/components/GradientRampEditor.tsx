import { useRef, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import type { GradientStop } from "../lib/shader-store";

interface Props {
    stops: GradientStop[];
    onChange: (stops: GradientStop[]) => void;
}

function stopKey(s: GradientStop, i: number) {
    return `${i}-${s.position.toFixed(3)}`;
}

function buildCss(stops: GradientStop[]): string {
    if (stops.length === 0) return "black";
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    const parts = sorted.map((s) => {
        const [r, g, b] = s.color.map((c) => Math.round(c * 255));
        return `rgb(${r},${g},${b}) ${(s.position * 100).toFixed(1)}%`;
    });
    return `linear-gradient(to right, ${parts.join(", ")})`;
}

export function GradientRampEditor({ stops, onChange }: Props) {
    const barRef = useRef<HTMLDivElement>(null);
    const [selected, setSelected] = useState<number | null>(null);

    function barXToPos(clientX: number): number {
        const rect = barRef.current!.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    function addStop(e: React.MouseEvent) {
        if ((e.target as HTMLElement).dataset.handle) return;
        const pos = barXToPos(e.clientX);
        const newStop: GradientStop = { position: pos, color: [1, 1, 1] };
        const next = [...stops, newStop].sort((a, b) => a.position - b.position);
        onChange(next);
        setSelected(next.findIndex((s) => s === newStop));
    }

    function removeStop(i: number) {
        if (stops.length <= 1) return;
        const next = stops.filter((_, idx) => idx !== i);
        onChange(next);
        setSelected(null);
    }

    function startDrag(i: number, e: React.MouseEvent) {
        e.stopPropagation();
        setSelected(i);
        const startX = e.clientX;
        const startPos = stops[i].position;

        function onMove(ev: MouseEvent) {
            const rect = barRef.current!.getBoundingClientRect();
            const newPos = Math.max(0, Math.min(1, startPos + (ev.clientX - startX) / rect.width));
            const next = stops.map((s, idx) => idx === i ? { ...s, position: newPos } : s);
            onChange(next);
        }

        function onUp() {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    const sorted = [...stops].map((s, i) => ({ ...s, _orig: i })).sort((a, b) => a.position - b.position);
    const selStop = selected !== null ? stops[selected] : null;

    return (
        <div className="flex flex-col gap-2">
            {/* Gradient bar */}
            <div
                ref={barRef}
                onClick={addStop}
                className="relative h-7 border border-border cursor-crosshair"
                style={{ background: buildCss(stops) }}
            >
                {sorted.map((s) => (
                    <div
                        key={stopKey(s, s._orig)}
                        data-handle="1"
                        onMouseDown={(e) => startDrag(s._orig, e)}
                        onDoubleClick={(e) => { e.stopPropagation(); removeStop(s._orig); }}
                        title="Drag to move · Double-click to delete"
                        className={`absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize flex items-end justify-center pb-0.5 ${
                            selected === s._orig ? "z-10" : "z-0"
                        }`}
                        style={{ left: `${s.position * 100}%` }}
                    >
                        <div
                            className={`w-2.5 h-3.5 border-2 ${
                                selected === s._orig ? "border-white" : "border-surface-4"
                            }`}
                            style={{ background: `rgb(${s.color.map((c) => Math.round(c * 255)).join(",")})` }}
                        />
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-surface-4">Click bar to add stop · Double-click stop to remove</p>

            {/* Color picker for selected stop */}
            {selStop !== null && (
                <div className="border border-border p-2 bg-surface-2">
                    <ColorPicker
                        value={selStop.color}
                        onChange={(c) => {
                            const next = stops.map((s, i) => i === selected ? { ...s, color: c as [number, number, number] } : s);
                            onChange(next);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
