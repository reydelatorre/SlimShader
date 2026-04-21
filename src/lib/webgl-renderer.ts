import {
    VERTEX_SHADER_SRC,
    FRAGMENT_WRAPPER_PREFIX,
    FRAGMENT_WRAPPER_SUFFIX,
} from "./default-shader";
import type { ShaderUniform } from "./shader-store";

export interface RendererError {
    type: "vertex" | "fragment" | "link";
    message: string;
}

export interface PassInfo {
    source: string;
    uniforms: ShaderUniform[];
}

export interface WebGLRenderer {
    updatePasses: (passes: PassInfo[]) => RendererError | null;
    resize: (w: number, h: number) => void;
    destroy: () => void;
    getError: () => RendererError | null;
}

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    src: string
): { shader: WebGLShader } | { error: string } {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(shader) ?? "unknown compile error";
        gl.deleteShader(shader);
        return { error: msg };
    }
    return { shader };
}

function buildFragmentSource(userSource: string, uniforms: ShaderUniform[]): string {
    const extraUniforms = uniforms
        .filter((u) => u.type !== "sampler2D")
        .map((u) => `uniform ${u.type} ${u.name};`)
        .join("\n");
    return FRAGMENT_WRAPPER_PREFIX + "\n" + extraUniforms + "\n" + userSource + "\n" + FRAGMENT_WRAPPER_SUFFIX;
}

function buildProgram(
    gl: WebGLRenderingContext,
    fragmentSource: string,
    uniforms: ShaderUniform[]
): { prog: WebGLProgram; error: null } | { prog: null; error: RendererError } {
    const full = buildFragmentSource(fragmentSource, uniforms);
    const vertResult = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    if ("error" in vertResult) return { prog: null, error: { type: "vertex", message: vertResult.error } };
    const fragResult = compileShader(gl, gl.FRAGMENT_SHADER, full);
    if ("error" in fragResult) {
        gl.deleteShader(vertResult.shader);
        return { prog: null, error: { type: "fragment", message: fragResult.error } };
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vertResult.shader);
    gl.attachShader(prog, fragResult.shader);
    gl.linkProgram(prog);
    gl.deleteShader(vertResult.shader);
    gl.deleteShader(fragResult.shader);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const msg = gl.getProgramInfoLog(prog) ?? "link error";
        gl.deleteProgram(prog);
        return { prog: null, error: { type: "link", message: msg } };
    }
    return { prog, error: null };
}

function sendUniform(gl: WebGLRenderingContext, prog: WebGLProgram, u: ShaderUniform) {
    const loc = gl.getUniformLocation(prog, u.name);
    if (!loc) return;
    const v = u.value;
    switch (u.type) {
        case "float": gl.uniform1f(loc, v as number); break;
        case "int":   gl.uniform1i(loc, v as number); break;
        case "bool":  gl.uniform1i(loc, (v as boolean) ? 1 : 0); break;
        case "vec2":  gl.uniform2fv(loc, v as number[]); break;
        case "vec3":  gl.uniform3fv(loc, v as number[]); break;
        case "vec4":  gl.uniform4fv(loc, v as number[]); break;
    }
}

interface FBO { tex: WebGLTexture; fb: WebGLFramebuffer }

function createFBO(gl: WebGLRenderingContext, w: number, h: number): FBO {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { tex, fb };
}

export function createWebGLRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
    const gl = canvas.getContext("webgl");
    if (!gl) return null;

    let programs: WebGLProgram[] = [];
    let passUniforms: ShaderUniform[][] = [];
    let fbos: FBO[] = [];
    let fboSize = { w: 0, h: 0 };
    let animFrame = 0;
    let startTime = performance.now();
    let mouseX = 0, mouseY = 0, clickX = 0, clickY = 0;
    let currentError: RendererError | null = null;

    // 1×1 black texture fed to pass 0 as iChannel0
    const blackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, blackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    canvas.addEventListener("mousemove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouseX = e.clientX - r.left;
        mouseY = canvas.height - (e.clientY - r.top);
    });
    canvas.addEventListener("mousedown", (e) => {
        const r = canvas.getBoundingClientRect();
        clickX = e.clientX - r.left;
        clickY = canvas.height - (e.clientY - r.top);
    });

    function ensureFBOs(count: number, w: number, h: number) {
        if (fbos.length === count && fboSize.w === w && fboSize.h === h) return;
        for (const { tex, fb } of fbos) { gl!.deleteTexture(tex); gl!.deleteFramebuffer(fb); }
        fbos = Array.from({ length: count }, () => createFBO(gl!, w, h));
        fboSize = { w, h };
    }

    function drawQuad(prog: WebGLProgram) {
        gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
        const pos = gl!.getAttribLocation(prog, "a_position");
        gl!.enableVertexAttribArray(pos);
        gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 0, 0);
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }

    function draw() {
        if (programs.length === 0) { animFrame = requestAnimationFrame(draw); return; }

        const w = canvas.width, h = canvas.height;
        const t = (performance.now() - startTime) / 1000;

        // Ensure we have N-1 FBOs for N passes
        if (programs.length > 1) ensureFBOs(programs.length - 1, w, h);

        let prevTex: WebGLTexture = blackTex;

        for (let i = 0; i < programs.length; i++) {
            const prog = programs[i];
            const isLast = i === programs.length - 1;

            if (isLast) {
                gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
            } else {
                gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbos[i].fb);
            }
            gl!.viewport(0, 0, w, h);
            gl!.useProgram(prog);

            const resLoc = gl!.getUniformLocation(prog, "iResolution");
            if (resLoc) gl!.uniform2f(resLoc, w, h);
            const timeLoc = gl!.getUniformLocation(prog, "iTime");
            if (timeLoc) gl!.uniform1f(timeLoc, t);
            const mouseLoc = gl!.getUniformLocation(prog, "iMouse");
            if (mouseLoc) gl!.uniform4f(mouseLoc, mouseX, mouseY, clickX, clickY);

            const chanLoc = gl!.getUniformLocation(prog, "iChannel0");
            if (chanLoc) {
                gl!.activeTexture(gl!.TEXTURE0);
                gl!.bindTexture(gl!.TEXTURE_2D, prevTex);
                gl!.uniform1i(chanLoc, 0);
            }

            for (const u of passUniforms[i]) sendUniform(gl!, prog, u);

            drawQuad(prog);

            if (!isLast) prevTex = fbos[i].tex;
        }

        animFrame = requestAnimationFrame(draw);
    }

    draw();

    return {
        updatePasses(passes) {
            const newPrograms: WebGLProgram[] = [];
            for (const pass of passes) {
                const result = buildProgram(gl!, pass.source, pass.uniforms);
                if (result.error) {
                    for (const p of newPrograms) gl!.deleteProgram(p);
                    currentError = result.error;
                    return result.error;
                }
                newPrograms.push(result.prog);
            }
            for (const p of programs) gl!.deleteProgram(p);
            programs = newPrograms;
            passUniforms = passes.map((p) => p.uniforms);
            currentError = null;
            return null;
        },

        resize(w, h) {
            canvas.width = w;
            canvas.height = h;
        },

        destroy() {
            cancelAnimationFrame(animFrame);
            for (const p of programs) gl!.deleteProgram(p);
            for (const { tex, fb } of fbos) { gl!.deleteTexture(tex); gl!.deleteFramebuffer(fb); }
            gl!.deleteTexture(blackTex);
        },

        getError() { return currentError; },
    };
}
