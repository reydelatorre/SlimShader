import { useRef } from "react";

interface Props {
    value: [number, number];
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: [number, number]) => void;
}

export function XYPad({ value, min = -1, max = 1, step, onChange }: Props) {
    const padRef = useRef<HTMLDivElement>(null);

    function snap(v: number) {
        if (!step) return v;
        return Math.round(v / step) * step;
    }

    function toRange(t: number) {
        return snap(Math.min(max, Math.max(min, min + t * (max - min))));
    }

    function getValues(ev: { clientX: number; clientY: number }): [number, number] {
        const rect = padRef.current!.getBoundingClientRect();
        const tx = (ev.clientX - rect.left) / rect.width;
        const ty = 1 - (ev.clientY - rect.top) / rect.height; // flip Y so up = positive
        return [toRange(tx), toRange(ty)];
    }

    function onMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        onChange(getValues(e));

        function onMove(ev: MouseEvent) { onChange(getValues(ev)); }
        function onUp() {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    const range = max - min;
    const cx = range > 0 ? ((value[0] - min) / range) * 100 : 50;
    const cy = range > 0 ? (1 - (value[1] - min) / range) * 100 : 50;

    return (
        <div
            ref={padRef}
            onMouseDown={onMouseDown}
            className="relative w-full h-28 bg-surface-3 border border-border cursor-crosshair select-none"
        >
            {/* axis guides */}
            <div className="absolute left-1/2 inset-y-0 border-l border-surface-4/25 pointer-events-none" />
            <div className="absolute top-1/2 inset-x-0 border-t border-surface-4/25 pointer-events-none" />
            {/* dot */}
            <div
                className="absolute w-2.5 h-2.5 rounded-full bg-accent-bright border border-white/20 pointer-events-none -translate-x-1/2 -translate-y-1/2 shadow"
                style={{ left: `${cx}%`, top: `${cy}%` }}
            />
            {/* corner labels */}
            <span className="absolute bottom-1 left-1.5 text-[9px] text-surface-4/50 pointer-events-none select-none">
                x {value[0].toFixed(2)}
            </span>
            <span className="absolute bottom-1 right-1.5 text-[9px] text-surface-4/50 pointer-events-none select-none">
                y {value[1].toFixed(2)}
            </span>
        </div>
    );
}
