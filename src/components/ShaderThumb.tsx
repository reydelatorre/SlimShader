import { useEffect, useRef } from "react";
import { createWebGLRenderer } from "../lib/webgl-renderer";
import type { PassInfo } from "../lib/webgl-renderer";

interface Props {
    passes: PassInfo[];
}

const THUMB_W = 320;
const THUMB_H = 180;

export function ShaderThumb({ passes }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = createWebGLRenderer(canvas);
        if (!renderer) return;
        renderer.resize(THUMB_W, THUMB_H);
        renderer.updatePasses(passes);
        return () => renderer.destroy();
    }, [passes]);

    return (
        <canvas
            ref={canvasRef}
            width={THUMB_W}
            height={THUMB_H}
            className="w-full"
            style={{ display: "block", aspectRatio: "16/9" }}
        />
    );
}
