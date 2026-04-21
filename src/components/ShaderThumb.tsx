import { useEffect, useRef } from "react";
import { createWebGLRenderer } from "../lib/webgl-renderer";
import type { ShaderUniform } from "../lib/shader-store";

interface Props {
    fragmentSource: string;
    uniforms: ShaderUniform[];
}

const THUMB_W = 320;
const THUMB_H = 180;

export function ShaderThumb({ fragmentSource, uniforms }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = createWebGLRenderer(canvas);
        if (!renderer) return;
        renderer.resize(THUMB_W, THUMB_H);
        renderer.updateSource(fragmentSource, uniforms);
        return () => renderer.destroy();
    }, [fragmentSource, uniforms]);

    return (
        <canvas
            ref={canvasRef}
            width={THUMB_W}
            height={THUMB_H}
            className="w-full rounded-t-lg"
            style={{ display: "block", aspectRatio: "16/9" }}
        />
    );
}
