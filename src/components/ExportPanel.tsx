import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ShaderEntry } from "../lib/shader-store";
import {
    convertToLove2D,
    generateMainLua,
    generateConfLua,
    generateReadme,
} from "../lib/love2d-export";

interface Props {
    shader: ShaderEntry;
}

export function ExportPanel({ shader }: Props) {
    const [copied, setCopied] = useState<"glsl" | "lua" | null>(null);
    const [tab, setTab] = useState<"glsl" | "lua" | "conf">("glsl");

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

    const TAB_CONTENT = { glsl, lua, conf };
    const TABS: { id: "glsl" | "lua" | "conf"; label: string }[] = [
        { id: "glsl", label: "shader.glsl" },
        { id: "lua", label: "main.lua" },
        { id: "conf", label: "conf.lua" },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">
                    Love2D Export
                </p>
                <button
                    onClick={handleDownloadZip}
                    className="w-full px-3 py-1.5 bg-accent hover:bg-accent-bright text-white text-xs transition-colors font-medium"
                >
                    Download .zip
                </button>
            </div>

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
