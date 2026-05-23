import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { createWebGLRenderer } from "./webgl-renderer";
import type { PassInfo } from "./webgl-renderer";
import type { PostSettings } from "./shader-store";

export interface GifOptions {
    size: number;
    frames: number;
    fps: number;
}

export async function renderShaderToGif(
    passes: PassInfo[],
    postSettings: PostSettings | null,
    opts: GifOptions,
    onProgress?: (frame: number, total: number) => void
): Promise<Blob> {
    const { size, frames, fps } = opts;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const renderer = createWebGLRenderer(canvas);
    if (!renderer) throw new Error("WebGL not supported in this browser");

    renderer.stopLoop();

    const err = renderer.updatePasses(passes);
    if (err) {
        renderer.destroy();
        throw new Error(`Shader error: ${err.message}`);
    }
    renderer.setPostProcessing(postSettings);

    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);

    for (let i = 0; i < frames; i++) {
        renderer.renderAtTime(i / fps);
        const rgba = renderer.readPixels();
        const palette = quantize(rgba, 256);
        const index = applyPalette(rgba, palette);
        gif.writeFrame(index, size, size, { palette, delay });
        onProgress?.(i + 1, frames);
        // Yield each frame so the progress bar can update
        await new Promise<void>((r) => setTimeout(r, 0));
    }

    renderer.destroy();
    gif.finish();
    return new Blob([gif.bytesView()], { type: "image/gif" });
}
