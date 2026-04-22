import { useEffect, useRef, useState } from "react";

// ── color math ────────────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m: [number, number, number][] = [
        [v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q],
    ];
    return m[i];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
        if (max === r)      h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, max ? d / max : 0, max];
}

const c01 = (x: number) => Math.max(0, Math.min(1, x));
const toHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
function fromHex(hex: string): [number, number, number] | null {
    const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

// ── drag on element ───────────────────────────────────────────────────────────

function useDragOn(
    ref: React.RefObject<HTMLDivElement | null>,
    onDrag: (x: number, y: number) => void,
) {
    return (e: React.MouseEvent) => {
        e.preventDefault();
        const el = ref.current;
        if (!el) return;
        const handle = (ev: MouseEvent) => {
            const r = el.getBoundingClientRect();
            onDrag(c01((ev.clientX - r.left) / r.width), c01((ev.clientY - r.top) / r.height));
        };
        handle(e.nativeEvent);
        const up = () => {
            window.removeEventListener("mousemove", handle);
            window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", handle);
        window.addEventListener("mouseup", up);
    };
}

// ── component ─────────────────────────────────────────────────────────────────

export function ColorPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
    const hasAlpha = value.length === 4;
    const a = value[3] ?? 1;

    const [open, setOpen] = useState(false);
    const [hsv, setHsv] = useState<[number, number, number]>(() =>
        rgbToHsv(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0)
    );
    const [hexStr, setHexStr] = useState(() => toHex(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0));

    const squareRef = useRef<HTMLDivElement>(null);
    const hueRef    = useRef<HTMLDivElement>(null);
    const alphaRef  = useRef<HTMLDivElement>(null);

    const [h, s, v] = hsv;
    const [cr, cg, cb] = hsvToRgb(h, s, v);
    const hueColor  = `hsl(${h},100%,50%)`;
    const swatchCss = `rgb(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)})`;

    // sync when external value changes
    useEffect(() => {
        setHsv(rgbToHsv(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0));
        setHexStr(toHex(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0));
    }, [value[0], value[1], value[2]]);

    function pushHsv(nh: number, ns: number, nv: number) {
        const [r, g, b] = hsvToRgb(nh, ns, nv);
        setHexStr(toHex(r, g, b));
        onChange(hasAlpha ? [r, g, b, a] : [r, g, b]);
    }

    function pushRgb(r: number, g: number, b: number) {
        setHsv(rgbToHsv(r, g, b));
        setHexStr(toHex(r, g, b));
        onChange(hasAlpha ? [r, g, b, a] : [r, g, b]);
    }

    const onSquare = useDragOn(squareRef, (x, y) => {
        const ns = x, nv = 1 - y;
        setHsv([h, ns, nv]);
        pushHsv(h, ns, nv);
    });

    const onHue = useDragOn(hueRef, (x) => {
        const nh = x * 360;
        setHsv([nh, s, v]);
        pushHsv(nh, s, v);
    });

    const onAlpha = useDragOn(alphaRef, (x) => {
        onChange([cr, cg, cb, x]);
    });

    return (
        <div className="flex flex-col gap-1.5 flex-1">
            {/* Swatch toggle */}
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 group">
                <div className="w-10 h-5 border border-border flex-shrink-0" style={{ background: swatchCss }} />
                <span className="text-surface-4 text-[10px] font-mono group-hover:text-white transition-colors">
                    {hexStr}
                </span>
            </button>

            {open && (
                <div className="flex flex-col gap-2 p-2 bg-surface-2 border border-border">
                    {/* HSV square */}
                    <div
                        ref={squareRef}
                        className="relative w-full cursor-crosshair select-none"
                        style={{
                            aspectRatio: "1",
                            background: `linear-gradient(to bottom,transparent,#000),
                                         linear-gradient(to right,#fff,${hueColor})`,
                        }}
                        onMouseDown={onSquare}
                    >
                        <div
                            className="absolute w-3 h-3 border-2 border-white pointer-events-lets none"
                            style={{
                                left: `${s * 100}%`, top: `${(1 - v) * 100}%`,
                                transform: "translate(-50%,-50%)",
                                boxShadow: "0 0 0 1px #000",
                            }}
                        />
                    </div>

                    {/* Hue strip */}
                    <div
                        ref={hueRef}
                        className="relative h-4 w-full cursor-ew-resize select-none"
                        style={{ background: "linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))" }}
                        onMouseDown={onHue}
                    >
                        <div
                            className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                            style={{ left: `${(h / 360) * 100}%`, transform: "translateX(-50%)", background: "#fff", boxShadow: "0 0 0 1px #000" }}
                        />
                    </div>

                    {/* Alpha strip */}
                    {hasAlpha && (
                        <div
                            ref={alphaRef}
                            className="relative h-4 w-full cursor-ew-resize select-none"
                            style={{ background: `linear-gradient(to right,transparent,${swatchCss})` }}
                            onMouseDown={onAlpha}
                        >
                            <div
                                className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                                style={{ left: `${a * 100}%`, transform: "translateX(-50%)", background: "#fff", boxShadow: "0 0 0 1px #000" }}
                            />
                        </div>
                    )}

                    {/* RGB (+ A) number inputs */}
                    <div className="flex gap-1">
                        {(hasAlpha ? ["R","G","B","A"] : ["R","G","B"]).map((lbl, i) => {
                            const vals = [cr, cg, cb, a];
                            return (
                                <label key={lbl} className="flex-1 flex flex-col items-center gap-0.5">
                                    <span className="text-surface-4 text-[10px]">{lbl}</span>
                                    <input
                                        type="number" min={0} max={255} step={1}
                                        value={Math.round(vals[i] * 255)}
                                        onChange={(e) => {
                                            const n = c01((parseInt(e.target.value) || 0) / 255);
                                            if (i === 3) onChange([cr, cg, cb, n]);
                                            else { const rgb = [cr,cg,cb]; rgb[i]=n; pushRgb(rgb[0],rgb[1],rgb[2]); }
                                        }}
                                        className="w-full bg-surface-3 text-white text-[10px] px-2 py-1.5 border border-border text-center"
                                    />
                                </label>
                            );
                        })}
                    </div>

                    {/* Hex input */}
                    <input
                        type="text"
                        value={hexStr}
                        onChange={(e) => {
                            setHexStr(e.target.value);
                            const p = fromHex(e.target.value);
                            if (p) pushRgb(...p);
                        }}
                        placeholder="#rrggbb"
                        className="w-full bg-surface-3 text-white text-xs px-2 py-1 border border-border font-mono focus:outline-none focus:border-accent-bright"
                    />
                </div>
            )}
        </div>
    );
}
