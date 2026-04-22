import { useEffect, useRef, useState } from "react";

interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    isInt?: boolean;
    onChange: (v: number) => void;
    className?: string;
}

function fmt(v: number, step?: number, isInt?: boolean): string {
    if (isInt) return String(Math.round(v));
    if (step !== undefined && step > 0 && step < 1) {
        const dec = Math.min(4, Math.round(-Math.log10(step)));
        return v.toFixed(dec);
    }
    if (step !== undefined && step >= 1) return v.toFixed(0);
    return v.toFixed(3);
}

export function ScrubInput({ value, min = 0, max = 1, step, isInt, onChange, className }: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    function clamp(v: number) {
        return Math.min(max, Math.max(min, v));
    }

    function snap(v: number) {
        if (!step) return v;
        return Math.round(v / step) * step;
    }

    function onMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        const startX = e.clientX;
        const startValue = value;
        let moved = false;

        function onMove(ev: MouseEvent) {
            const dx = ev.clientX - startX;
            if (!moved && Math.abs(dx) < 3) return;
            moved = true;
            const range = max - min;
            const sensitivity = ev.shiftKey ? range / 1500 : range / 150;
            onChange(snap(clamp(startValue + dx * sensitivity)));
        }

        function onUp() {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (!moved) {
                setDraft(fmt(value, step, isInt));
                setEditing(true);
            }
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function commitDraft() {
        const n = parseFloat(draft);
        if (!isNaN(n)) onChange(snap(clamp(n)));
        setEditing(false);
    }

    const pct = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) * 100 : 0;

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commitDraft();
                    if (e.key === "Escape") setEditing(false);
                }}
                className={`w-full bg-surface-2 border border-accent-bright text-white text-xs px-2 py-1.5 text-right focus:outline-none ${className ?? ""}`}
            />
        );
    }

    return (
        <div
            onMouseDown={onMouseDown}
            title="Drag to scrub · Shift for fine control · Click to type"
            className={`relative select-none cursor-ew-resize bg-surface-3 border border-border text-xs text-white text-right px-2 py-1.5 overflow-hidden ${className ?? ""}`}
        >
            <div
                className="absolute inset-y-0 left-0 bg-accent/20 pointer-events-none"
                style={{ width: `${pct}%` }}
            />
            <span className="relative z-10">{fmt(value, step, isInt)}</span>
        </div>
    );
}
