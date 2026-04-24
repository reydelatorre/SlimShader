import {
    VERTEX_SHADER_SRC,
    FRAGMENT_WRAPPER_PREFIX,
    MESH_FRAGMENT_PREFIX,
} from "./default-shader";
import type { ShaderUniform, GradientStop, PostSettings } from "./shader-store";
import type { MeshData } from "./obj-loader";

export interface RendererError {
    type: "vertex" | "fragment" | "link";
    message: string;
}

export interface PassInfo {
    source: string;
    uniforms: ShaderUniform[];
    blendMode?: "replace" | "mix"
        | "add" | "subtract" | "difference"
        | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light"
        | "darken" | "lighten" | "color-dodge" | "color-burn";
    opacity?: number;
}

export interface WebGLRenderer {
    updatePasses: (passes: PassInfo[]) => RendererError | null;
    setPostProcessing: (settings: PostSettings | null) => void;
    setMesh: (data: MeshData) => void;
    clearMesh: () => void;
    setMeshTransform: (scale: number, rotX: number, rotY: number, rotZ: number) => void;
    setWireframe: (mode: number) => void;
    resize: (w: number, h: number) => void;
    destroy: () => void;
    getError: () => RendererError | null;
}

// Post-processing fragment shader
const POST_FRAGMENT_SRC = `#version 300 es
precision highp float;
uniform sampler2D uScreen;
uniform vec2      iResolution;
uniform float     uBrightness;
uniform float     uContrast;
uniform float     uSaturation;
uniform float     uHue;
uniform float     uExposure;
out vec4 _slimOut;

vec3 rgb2hsl(vec3 c) {
    float M = max(c.r, max(c.g, c.b));
    float m = min(c.r, min(c.g, c.b));
    float d = M - m;
    float h = 0.0, s = 0.0, l = (M + m) * 0.5;
    if (d > 0.0) {
        s = d / (1.0 - abs(2.0 * l - 1.0));
        if (M == c.r)      h = mod((c.g - c.b) / d, 6.0);
        else if (M == c.g) h = (c.b - c.r) / d + 2.0;
        else               h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
    }
    return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 c) {
    float h = c.x, s = c.y, l = c.z;
    float a = s * min(l, 1.0 - l);
    return l + a * vec3(
        clamp(abs(mod(h * 6.0 + 0.0, 6.0) - 3.0) - 1.0, -1.0, 1.0),
        clamp(abs(mod(h * 6.0 + 4.0, 6.0) - 3.0) - 1.0, -1.0, 1.0),
        clamp(abs(mod(h * 6.0 + 2.0, 6.0) - 3.0) - 1.0, -1.0, 1.0)
    );
}

void main() {
    vec2 uv  = gl_FragCoord.xy / iResolution;
    vec4 col = texture(uScreen, uv);

    col.rgb *= pow(2.0, uExposure);
    col.rgb += uBrightness - 1.0;
    col.rgb  = (col.rgb - 0.5) * uContrast + 0.5;

    vec3 hsl = rgb2hsl(col.rgb);
    hsl.y   *= uSaturation;
    hsl.x    = mod(hsl.x + uHue / 360.0, 1.0);
    col.rgb  = hsl2rgb(hsl);

    _slimOut = vec4(clamp(col.rgb, 0.0, 1.0), col.a);
}
`;

function compileShader(
    gl: WebGL2RenderingContext,
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

function blendSuffix(blendMode: PassInfo["blendMode"], opacity: number): string {
    const ops: Record<string, string> = {
        "replace":     `_slimOut = fragColor;`,
        "mix":         `_slimOut = mix(prev, fragColor, ${opacity.toFixed(3)});`,
        "add":         `_slimOut = vec4(clamp(prev.rgb + fragColor.rgb, 0.0, 1.0), fragColor.a);`,
        "subtract":    `_slimOut = vec4(clamp(prev.rgb - fragColor.rgb, 0.0, 1.0), fragColor.a);`,
        "difference":  `_slimOut = vec4(abs(prev.rgb - fragColor.rgb), fragColor.a);`,
        "multiply":    `_slimOut = vec4(prev.rgb * fragColor.rgb, fragColor.a);`,
        "screen":      `_slimOut = vec4(1.0 - (1.0 - prev.rgb) * (1.0 - fragColor.rgb), fragColor.a);`,
        "overlay":     `{ vec3 _b = step(0.5, prev.rgb); _slimOut = vec4(mix(2.0*prev.rgb*fragColor.rgb, 1.0-2.0*(1.0-prev.rgb)*(1.0-fragColor.rgb), _b), fragColor.a); }`,
        "soft-light":  `{ vec3 _s = fragColor.rgb; vec3 _d = prev.rgb; _slimOut = vec4(_d + (2.0*_s - 1.0)*(_d - _d*_d), fragColor.a); }`,
        "hard-light":  `{ vec3 _b = step(0.5, fragColor.rgb); _slimOut = vec4(mix(2.0*prev.rgb*fragColor.rgb, 1.0-2.0*(1.0-prev.rgb)*(1.0-fragColor.rgb), _b), fragColor.a); }`,
        "darken":      `_slimOut = vec4(min(prev.rgb, fragColor.rgb), fragColor.a);`,
        "lighten":     `_slimOut = vec4(max(prev.rgb, fragColor.rgb), fragColor.a);`,
        "color-dodge": `_slimOut = vec4(clamp(prev.rgb / max(1.0 - fragColor.rgb, 0.0001), 0.0, 1.0), fragColor.a);`,
        "color-burn":  `_slimOut = vec4(clamp(1.0 - (1.0 - prev.rgb) / max(fragColor.rgb, 0.0001), 0.0, 1.0), fragColor.a);`,
    };
    const op = ops[blendMode ?? "replace"] ?? `_slimOut = fragColor;`;

    return `
void main() {
    vec4 fragColor;
    mainImage(fragColor, gl_FragCoord.xy);
    vec2 _uv = gl_FragCoord.xy / iResolution.xy;
    vec4 prev = texture(iChannel0, _uv);
    ${op}
}`;
}

function buildFragmentSource(pass: PassInfo, hasMesh: boolean): string {
    const extraUniforms = pass.uniforms
        .filter((u) => u.type !== "sampler2D")
        .filter((u) => !new RegExp(`\\buniform\\b[^;]*\\b${u.name}\\b`).test(pass.source))
        .map((u) => {
            if (u.type === "select") return `uniform int ${u.name};`;
            if (u.type === "ramp")   return `uniform sampler2D ${u.name};`;
            return `uniform ${u.type} ${u.name};`;
        })
        .join("\n");
    return (
        FRAGMENT_WRAPPER_PREFIX +
        (hasMesh ? MESH_FRAGMENT_PREFIX : "") + "\n" +
        extraUniforms + "\n" +
        pass.source + "\n" +
        blendSuffix(pass.blendMode, pass.opacity ?? 1)
    );
}

function buildProgram(
    gl: WebGL2RenderingContext,
    pass: PassInfo,
    hasMesh: boolean
): { prog: WebGLProgram; error: null } | { prog: null; error: RendererError } {
    const full = buildFragmentSource(pass, hasMesh);
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

function buildPostProgram(
    gl: WebGL2RenderingContext
): WebGLProgram | null {
    const vertResult = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    if ("error" in vertResult) return null;
    const fragResult = compileShader(gl, gl.FRAGMENT_SHADER, POST_FRAGMENT_SRC);
    if ("error" in fragResult) { gl.deleteShader(vertResult.shader); return null; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vertResult.shader);
    gl.attachShader(prog, fragResult.shader);
    gl.linkProgram(prog);
    gl.deleteShader(vertResult.shader);
    gl.deleteShader(fragResult.shader);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl.deleteProgram(prog); return null; }
    return prog;
}

function sendUniform(gl: WebGL2RenderingContext, prog: WebGLProgram, u: ShaderUniform) {
    const loc = gl.getUniformLocation(prog, u.name);
    if (!loc) return;
    const v = u.value;
    switch (u.type) {
        case "float":  gl.uniform1f(loc, v as number); break;
        case "int":    gl.uniform1i(loc, v as number); break;
        case "select": gl.uniform1i(loc, v as number); break;
        case "bool":   gl.uniform1i(loc, (v as boolean) ? 1 : 0); break;
        case "vec2":  gl.uniform2fv(loc, v as number[]); break;
        case "vec3":  gl.uniform3fv(loc, v as number[]); break;
        case "vec4":  gl.uniform4fv(loc, v as number[]); break;
        // "ramp" texture binding is handled in draw()
    }
}

function buildRampPixels(stops: GradientStop[]): Uint8Array {
    const N = 256;
    const data = new Uint8Array(N * 4);
    const sorted = [...stops].sort((a, b) => a.position - b.position);

    for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        let r = 0, g = 0, b = 0;

        if (sorted.length === 0) {
            // keep black
        } else if (sorted.length === 1) {
            [r, g, b] = sorted[0].color;
        } else {
            const lo = sorted.findLast((s) => s.position <= t) ?? sorted[0];
            const hi = sorted.find((s) => s.position >= t) ?? sorted[sorted.length - 1];
            if (lo === hi) {
                [r, g, b] = lo.color;
            } else {
                const f = (t - lo.position) / (hi.position - lo.position);
                r = lo.color[0] + (hi.color[0] - lo.color[0]) * f;
                g = lo.color[1] + (hi.color[1] - lo.color[1]) * f;
                b = lo.color[2] + (hi.color[2] - lo.color[2]) * f;
            }
        }

        data[i * 4 + 0] = Math.round(r * 255);
        data[i * 4 + 1] = Math.round(g * 255);
        data[i * 4 + 2] = Math.round(b * 255);
        data[i * 4 + 3] = 255;
    }
    return data;
}

interface FBO { tex: WebGLTexture; fb: WebGLFramebuffer }

function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO {
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
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return null;

    let programs: WebGLProgram[] = [];
    let currentPasses: PassInfo[] = [];
    let fbos: FBO[] = [];
    let screenFBO: FBO | null = null;
    let fboSize = { w: 0, h: 0 };
    let animFrame = 0;
    let startTime = performance.now();
    let mouseX = 0, mouseY = 0, clickX = 0, clickY = 0;
    let currentError: RendererError | null = null;
    let postSettings: PostSettings | null = null;
    const postProgram = buildPostProgram(gl);

    // Ramp texture cache: key = uniform name, value = { sig, tex }
    const rampCache = new Map<string, { sig: string; tex: WebGLTexture }>();

    // Mesh state
    let meshTex: WebGLTexture | null = null;
    let meshNumTris = 0;
    let meshTexHeight = 1;
    let meshMin: [number, number, number] = [0, 0, 0];
    let meshRange = 1;
    let meshScale = 1;
    let meshRotX = 0, meshRotY = 0, meshRotZ = 0;
    let wireframeMode = 0;

    const blackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, blackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const blackMeshTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, blackMeshTex);
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

    function ensureScreenFBO(w: number, h: number) {
        if (screenFBO && fboSize.w === w && fboSize.h === h) return;
        if (screenFBO) { gl!.deleteTexture(screenFBO.tex); gl!.deleteFramebuffer(screenFBO.fb); }
        screenFBO = createFBO(gl!, w, h);
    }

    function getRampTex(u: ShaderUniform): WebGLTexture | null {
        const stops = u.stops ?? [];
        const sig = JSON.stringify(stops);
        const cached = rampCache.get(u.name);
        if (cached && cached.sig === sig) return cached.tex;

        if (cached) gl!.deleteTexture(cached.tex);

        const tex = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D, tex);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 256, 1, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, buildRampPixels(stops));
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        gl!.bindTexture(gl!.TEXTURE_2D, null);

        rampCache.set(u.name, { sig, tex });
        return tex;
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
        const usePost = postSettings !== null && postProgram !== null;

        if (usePost) {
            ensureFBOs(programs.length, w, h);
            ensureScreenFBO(w, h);
        } else {
            ensureFBOs(programs.length - 1, w, h);
        }

        let prevTex: WebGLTexture = blackTex;

        for (let i = 0; i < programs.length; i++) {
            const prog = programs[i];
            const isLast = i === programs.length - 1;
            const targetFB = (!usePost && isLast) ? null : fbos[i].fb;

            gl!.bindFramebuffer(gl!.FRAMEBUFFER, targetFB);
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

            const meshLoc = gl!.getUniformLocation(prog, "iMesh");
            if (meshLoc) {
                gl!.activeTexture(gl!.TEXTURE1);
                gl!.bindTexture(gl!.TEXTURE_2D, meshTex ?? blackMeshTex);
                gl!.uniform1i(meshLoc, 1);
            }
            const uMeshMin = gl!.getUniformLocation(prog, "uMeshMin");
            if (uMeshMin) gl!.uniform3f(uMeshMin, meshMin[0], meshMin[1], meshMin[2]);
            const uMeshRange = gl!.getUniformLocation(prog, "uMeshRange");
            if (uMeshRange) gl!.uniform1f(uMeshRange, meshRange);
            const uMeshHeight = gl!.getUniformLocation(prog, "uMeshHeight");
            if (uMeshHeight) gl!.uniform1i(uMeshHeight, meshTexHeight);
            const uNumTris = gl!.getUniformLocation(prog, "uNumTris");
            if (uNumTris) gl!.uniform1i(uNumTris, meshNumTris);
            const uMeshScale = gl!.getUniformLocation(prog, "uMeshScale");
            if (uMeshScale) gl!.uniform1f(uMeshScale, meshScale);
            const uMeshRotX = gl!.getUniformLocation(prog, "uMeshRotX");
            if (uMeshRotX) gl!.uniform1f(uMeshRotX, meshRotX);
            const uMeshRotY = gl!.getUniformLocation(prog, "uMeshRotY");
            if (uMeshRotY) gl!.uniform1f(uMeshRotY, meshRotY);
            const uMeshRotZ = gl!.getUniformLocation(prog, "uMeshRotZ");
            if (uMeshRotZ) gl!.uniform1f(uMeshRotZ, meshRotZ);
            const uWireframe = gl!.getUniformLocation(prog, "uWireframe");
            if (uWireframe) gl!.uniform1i(uWireframe, wireframeMode);

            // User uniforms — scalars first, then ramp textures at TEXTURE2+
            let rampSlot = 2;
            for (const u of currentPasses[i].uniforms) {
                if (u.type === "ramp") {
                    const loc = gl!.getUniformLocation(prog, u.name);
                    const tex = getRampTex(u);
                    if (loc && tex) {
                        gl!.activeTexture(gl!.TEXTURE0 + rampSlot);
                        gl!.bindTexture(gl!.TEXTURE_2D, tex);
                        gl!.uniform1i(loc, rampSlot);
                    }
                    rampSlot++;
                } else {
                    sendUniform(gl!, prog, u);
                }
            }

            drawQuad(prog);
            prevTex = fbos[i]?.tex ?? blackTex;
        }

        // Post-processing pass
        if (usePost && postProgram && postSettings) {
            gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
            gl!.viewport(0, 0, w, h);
            gl!.useProgram(postProgram);

            const screenLoc = gl!.getUniformLocation(postProgram, "uScreen");
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.bindTexture(gl!.TEXTURE_2D, prevTex);
            if (screenLoc) gl!.uniform1i(screenLoc, 0);

            const resLoc = gl!.getUniformLocation(postProgram, "iResolution");
            if (resLoc) gl!.uniform2f(resLoc, w, h);

            gl!.uniform1f(gl!.getUniformLocation(postProgram, "uBrightness")!,  postSettings.brightness);
            gl!.uniform1f(gl!.getUniformLocation(postProgram, "uContrast")!,    postSettings.contrast);
            gl!.uniform1f(gl!.getUniformLocation(postProgram, "uSaturation")!,  postSettings.saturation);
            gl!.uniform1f(gl!.getUniformLocation(postProgram, "uHue")!,         postSettings.hue);
            gl!.uniform1f(gl!.getUniformLocation(postProgram, "uExposure")!,    postSettings.exposure);

            drawQuad(postProgram);
        }

        animFrame = requestAnimationFrame(draw);
    }

    draw();

    function recompile(hasMesh: boolean): RendererError | null {
        const newPrograms: WebGLProgram[] = [];
        for (const pass of currentPasses) {
            const result = buildProgram(gl!, pass, hasMesh);
            if (result.error) {
                for (const p of newPrograms) gl!.deleteProgram(p);
                currentError = result.error;
                return result.error;
            }
            newPrograms.push(result.prog);
        }
        for (const p of programs) gl!.deleteProgram(p);
        programs = newPrograms;
        currentError = null;
        return null;
    }

    return {
        updatePasses(passes) {
            currentPasses = passes;
            return recompile(meshNumTris > 0);
        },

        setPostProcessing(settings) {
            postSettings = settings;
        },

        setMesh(data) {
            if (meshTex) { gl!.deleteTexture(meshTex); meshTex = null; }
            const tex = gl!.createTexture()!;
            gl!.bindTexture(gl!.TEXTURE_2D, tex);
            gl!.texImage2D(
                gl!.TEXTURE_2D, 0, gl!.RGBA,
                data.texWidth, data.texHeight,
                0, gl!.RGBA, gl!.UNSIGNED_BYTE, data.pixels
            );
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
            gl!.bindTexture(gl!.TEXTURE_2D, null);
            meshTex = tex;
            meshNumTris = data.numTris;
            meshTexHeight = data.texHeight;
            meshMin = data.meshMin;
            meshRange = data.meshRange;
            recompile(true);
        },

        clearMesh() {
            if (meshTex) { gl!.deleteTexture(meshTex); meshTex = null; }
            meshNumTris = 0;
            meshTexHeight = 1;
            recompile(false);
        },

        setMeshTransform(scale, rotX, rotY, rotZ) {
            meshScale = scale;
            meshRotX = rotX;
            meshRotY = rotY;
            meshRotZ = rotZ;
        },

        setWireframe(mode) {
            wireframeMode = mode;
        },

        resize(w, h) {
            canvas.width = w;
            canvas.height = h;
        },

        destroy() {
            cancelAnimationFrame(animFrame);
            for (const p of programs) gl!.deleteProgram(p);
            for (const { tex, fb } of fbos) { gl!.deleteTexture(tex); gl!.deleteFramebuffer(fb); }
            if (screenFBO) { gl!.deleteTexture(screenFBO.tex); gl!.deleteFramebuffer(screenFBO.fb); }
            if (postProgram) gl!.deleteProgram(postProgram);
            gl!.deleteTexture(blackTex);
            gl!.deleteTexture(blackMeshTex);
            if (meshTex) gl!.deleteTexture(meshTex);
            for (const { tex } of rampCache.values()) gl!.deleteTexture(tex);
        },

        getError() { return currentError; },
    };
}
