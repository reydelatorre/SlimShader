import { useEffect, useRef, useState } from "react";
import { createWebGLRenderer, type WebGLRenderer, type RendererError, type PassInfo } from "../lib/webgl-renderer";
import type { MeshData } from "../lib/obj-loader";
import type { PostSettings } from "../lib/shader-store";

interface Props {
    passes: PassInfo[];
    onError: (err: RendererError | null) => void;
    captureRef?: React.MutableRefObject<(() => string | null) | null>;
    meshData?: MeshData | null;
    meshScale?: number;
    meshRotX?: number;
    meshRotY?: number;
    meshRotZ?: number;
    wireframe?: number;
    postSettings?: PostSettings | null;
}

export function ShaderPreview({ passes, onError, captureRef, meshData, meshScale = 1, meshRotX = 0, meshRotY = 0, meshRotZ = 0, wireframe = 0, postSettings }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<WebGLRenderer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = createWebGLRenderer(canvas);
        if (!renderer) { setSupported(false); return; }
        rendererRef.current = renderer;
        if (captureRef) captureRef.current = () => canvas.toDataURL("image/png");
        return () => {
            renderer.destroy();
            rendererRef.current = null;
            if (captureRef) captureRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        onError(renderer.updatePasses(passes));
    }, [passes, onError]);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        if (meshData) renderer.setMesh(meshData);
        else renderer.clearMesh();
    }, [meshData]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        rendererRef.current?.setMeshTransform(meshScale, meshRotX, meshRotY, meshRotZ);
    }, [meshScale, meshRotX, meshRotY, meshRotZ]);

    useEffect(() => {
        rendererRef.current?.setWireframe(wireframe);
    }, [wireframe]);

    useEffect(() => {
        rendererRef.current?.setPostProcessing(postSettings ?? null);
    }, [postSettings]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const obs = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            rendererRef.current?.resize(Math.round(width), Math.round(height));
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, []);

    if (!supported) {
        return (
            <div className="flex-1 flex items-center justify-center bg-surface-1 text-surface-4 text-xs">
                WebGL not supported in this browser.
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 relative bg-black">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />
        </div>
    );
}
