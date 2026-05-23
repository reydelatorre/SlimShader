import { useState } from "react";
import React from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ShaderEntry } from "../lib/shader-store";
import type { GifOptions } from "../lib/gif-capture";
import {
    convertToLove2D,
    generateMainLua,
    generateConfLua,
    generateReadme,
} from "../lib/love2d-export";

type GifCaptureFn = (opts: GifOptions, onProgress?: (n: number, total: number) => void) => Promise<Blob>;

interface Props {
    shader: ShaderEntry;
    captureRef?: React.MutableRefObject<(() => string | null) | null>;
    gifCaptureRef?: React.MutableRefObject<GifCaptureFn | null>;
}

const GIF_SIZES = [320, 480, 640] as const;
const GIF_FPS_OPTIONS = [12, 15, 24] as const;

export function ExportPanel({ shader, captureRef, gifCaptureRef }: Props) {
    const [copied, setCopied] = useState<"glsl" | "lua" | null>(null);
    const [tab, setTab] = useState<"glsl" | "lua" | "conf">("glsl");

    const [gifSize, setGifSize] = useState<number>(480);
    const [gifFrames, setGifFrames] = useState(60);
    const [gifFps, setGifFps] = useState<number>(12);
    const [gifRendering, setGifRendering] = useState(false);
    const [gifProgress, setGifProgress] = useState(0);
    const [gifError, setGifError] = useState<string | null>(null);

    function handleCapturePng() {
        const dataUrl = captureRef?.current?.();
        if (!dataUrl) return;
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${shader.name.replace(/\s+/g, "-")}.png`;
        a.click();
    }

    const glsl = convertToLove2D(shader);
    const lua = generateMainLua(shader);
    const conf = generateConfLua(shader);

    async function handleDownloadZip() {
        const zip = new JSZip();
        const folder = zip.folder(shader.name.replace(/\s+/g, "-"))!;
        folder.file("shader.glsl", glsl);
        folder.file("main.lua", lua);
        folder.file("conf.lua", conf);
        folder.file("README.md", generateReadme(shader));
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `${shader.name.replace(/\s+/g, "-")}-love2d.zip`);
    }

    async function handleCopy(content: string, which: "glsl" | "lua") {
        await navigator.clipboard.writeText(content);
        setCopied(which);
        setTimeout(() => setCopied(null), 1500);
    }

    async function handleRenderGif() {
        if (!gifCaptureRef?.current) return;
        setGifRendering(true);
        setGifProgress(0);
        setGifError(null);
        try {
            const blob = await gifCaptureRef.current(
                { size: gifSize, frames: gifFrames, fps: gifFps },
                (n) => setGifProgress(n)
            );
            saveAs(blob, `${shader.name.replace(/\s+/g, "-")}.gif`);
        } catch (e) {
            setGifError(e instanceof Error ? e.message : "Render failed");
        } finally {
            setGifRendering(false);
            setGifProgress(0);
        }
    }

    const gifDuration = (gifFrames / gifFps).toFixed(1);
    const gifProgressPct = gifFrames > 0 ? (gifProgress / gifFrames) * 100 : 0;

    const TAB_CONTENT = { glsl, lua, conf };
    const TABS: { id: "glsl" | "lua" | "conf"; label: string }[] = [
        { id: "glsl", label: "shader.glsl" },
        { id: "lua", label: "main.lua" },
        { id: "conf", label: "conf.lua" },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* PNG + Love2D */}
            <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">
                    Export
                </p>
                <div className="flex flex-col gap-1.5">
                    <button
                        onClick={handleCapturePng}
                        className="w-full px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border text-white text-xs transition-colors"
                    >
                        Capture Frame (PNG)
                    </button>
                    <button
                        onClick={handleDownloadZip}
                        className="w-full px-3 py-1.5 bg-accent hover:bg-accent-bright text-white text-xs transition-colors font-medium"
                    >
                        Download Love2D .zip
                    </button>
                </div>
            </div>

            {/* GIF Export */}
            <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">
                    GIF Export
                </p>
                <div className="flex flex-col gap-2">
                    {/* Resolution */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-surface-4 w-14 flex-shrink-0">Resolution</span>
                        <div className="flex gap-1">
                            {GIF_SIZES.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setGifSize(s)}
                                    className={`px-2 py-0.5 text-[10px] border transition-colors ${
                                        gifSize === s
                                            ? "border-accent-bright text-accent-bright"
                                            : "border-border text-surface-4 hover:text-white"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Frames + duration */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-surface-4 w-14 flex-shrink-0">Frames</span>
                        <input
                            type="number"
                            value={gifFrames}
                            min={1}
                            max={600}
                            onChange={(e) => setGifFrames(Math.max(1, Math.min(600, parseInt(e.target.value) || 1)))}
                            className="w-14 bg-surface-2 border border-border px-2 py-0.5 text-white text-[10px] focus:outline-none focus:border-accent-bright"
                        />
                        <span className="text-[10px] text-surface-4">{gifDuration}s</span>
                    </div>

                    {/* FPS */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-surface-4 w-14 flex-shrink-0">FPS</span>
                        <div className="flex gap-1">
                            {GIF_FPS_OPTIONS.map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setGifFps(f)}
                                    className={`px-2 py-0.5 text-[10px] border transition-colors ${
                                        gifFps === f
                                            ? "border-accent-bright text-accent-bright"
                                            : "border-border text-surface-4 hover:text-white"
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Render button */}
                    <button
                        onClick={handleRenderGif}
                        disabled={gifRendering || !gifCaptureRef?.current}
                        className="w-full px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border text-white text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {gifRendering
                            ? `Rendering… ${gifProgress} / ${gifFrames}`
                            : "Render GIF"}
                    </button>

                    {/* Progress bar */}
                    {gifRendering && (
                        <div className="w-full h-0.5 bg-surface-3 overflow-hidden">
                            <div
                                className="h-full bg-accent-bright transition-all duration-75"
                                style={{ width: `${gifProgressPct}%` }}
                            />
                        </div>
                    )}

                    {gifError && (
                        <p className="text-red-400 text-[10px] leading-relaxed">{gifError}</p>
                    )}
                </div>
            </div>

            {/* Source tabs */}
            <div className="flex border-b border-border">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 text-[10px] py-1.5 transition-colors border-r border-border last:border-0 ${
                            tab === t.id
                                ? "text-accent-bright bg-surface-2"
                                : "text-surface-4 hover:text-white"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 relative overflow-hidden">
                <button
                    onClick={() => handleCopy(TAB_CONTENT[tab], tab === "glsl" ? "glsl" : "lua")}
                    className="absolute top-2 right-2 z-10 text-[10px] text-surface-4 hover:text-white bg-surface-3 px-2 py-0.5 border border-border transition-colors"
                >
                    {copied ? "copied!" : "copy"}
                </button>
                <pre className="h-full overflow-auto p-3 text-[11px] text-green-300 leading-relaxed">
                    {TAB_CONTENT[tab]}
                </pre>
            </div>
        </div>
    );
}
