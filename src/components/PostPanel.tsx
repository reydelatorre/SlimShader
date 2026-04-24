import { ScrubInput } from "./ScrubInput";
import type { PostSettings } from "../lib/shader-store";

const DEFAULTS: PostSettings = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    exposure: 0,
};

interface Props {
    settings: PostSettings | null;
    onChange: (s: PostSettings | null) => void;
}

const PARAMS: Array<{
    key: keyof PostSettings;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
}> = [
    { key: "exposure",   label: "Exposure",    min: -3,  max: 3,   step: 0.05, default: 0 },
    { key: "brightness", label: "Brightness",  min: 0,   max: 3,   step: 0.05, default: 1 },
    { key: "contrast",   label: "Contrast",    min: 0,   max: 3,   step: 0.05, default: 1 },
    { key: "saturation", label: "Saturation",  min: 0,   max: 3,   step: 0.05, default: 1 },
    { key: "hue",        label: "Hue Shift",   min: -180, max: 180, step: 1,   default: 0 },
];

export function PostPanel({ settings, onChange }: Props) {
    const enabled = settings !== null;
    const s = settings ?? DEFAULTS;

    function toggle() {
        onChange(enabled ? null : { ...DEFAULTS });
    }

    function update(key: keyof PostSettings, val: number) {
        onChange({ ...s, [key]: val });
    }

    function reset() {
        onChange({ ...DEFAULTS });
    }

    const isDirty = enabled && PARAMS.some((p) => Math.abs(s[p.key] - p.default) > 1e-6);

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest">Post Processing</p>
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <button
                            onClick={reset}
                            className="text-[10px] text-surface-4 hover:text-white transition-colors"
                        >
                            reset
                        </button>
                    )}
                    <button
                        onClick={toggle}
                        className={`text-[10px] px-2 py-0.5 border transition-colors ${
                            enabled
                                ? "border-accent text-accent hover:border-surface-4 hover:text-surface-4"
                                : "border-border text-surface-4 hover:border-accent hover:text-accent"
                        }`}
                    >
                        {enabled ? "on" : "off"}
                    </button>
                </div>
            </div>

            <div className={`flex-1 flex flex-col gap-0 ${!enabled ? "opacity-40 pointer-events-none" : ""}`}>
                {PARAMS.map((p) => (
                    <div key={p.key} className="px-3 py-2 border-b border-border flex items-center gap-3">
                        <span className="text-surface-4 text-[10px] w-20 flex-shrink-0">{p.label}</span>
                        <ScrubInput
                            value={s[p.key]}
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            onChange={(v) => update(p.key, v)}
                            className="flex-1"
                        />
                        {Math.abs(s[p.key] - p.default) > 1e-6 && (
                            <button
                                onClick={() => update(p.key, p.default)}
                                className="text-[10px] text-surface-4 hover:text-white transition-colors flex-shrink-0"
                            >
                                ↺
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {!enabled && (
                <div className="px-3 py-3 text-surface-4 text-xs">
                    Enable to apply global color grading.
                </div>
            )}
        </div>
    );
}
