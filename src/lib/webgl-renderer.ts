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

export interface WebGLRenderer {
    updateSource: (fragmentSource: string, uniforms: ShaderUniform[]) => RendererError | null;
    setUniformValue: (name: string, value: number | number[] | boolean) => void;
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
    return (
        FRAGMENT_WRAPPER_PREFIX +
        "\n" +
        extraUniforms +
        "\n" +
        userSource +
        "\n" +
        FRAGMENT_WRAPPER_SUFFIX
    );
}

export function createWebGLRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
    const gl = canvas.getContext("webgl");
    if (!gl) return null;

    let program: WebGLProgram | null = null;
    let animFrame = 0;
    let startTime = performance.now();
    let mouseX = 0;
    let mouseY = 0;
    let clickX = 0;
    let clickY = 0;
    let currentError: RendererError | null = null;
    let currentUniforms: ShaderUniform[] = [];

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
    );

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = canvas.height - (e.clientY - rect.top);
    });
    canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        clickX = e.clientX - rect.left;
        clickY = canvas.height - (e.clientY - rect.top);
    });

    function buildProgram(
        fragmentSource: string,
        uniforms: ShaderUniform[]
    ): { prog: WebGLProgram; error: null } | { prog: null; error: RendererError } {
        const full = buildFragmentSource(fragmentSource, uniforms);

        const vertResult = compileShader(gl!, gl!.VERTEX_SHADER, VERTEX_SHADER_SRC);
        if ("error" in vertResult) {
            return { prog: null, error: { type: "vertex", message: vertResult.error } };
        }

        const fragResult = compileShader(gl!, gl!.FRAGMENT_SHADER, full);
        if ("error" in fragResult) {
            gl!.deleteShader(vertResult.shader);
            return { prog: null, error: { type: "fragment", message: fragResult.error } };
        }

        const prog = gl!.createProgram()!;
        gl!.attachShader(prog, vertResult.shader);
        gl!.attachShader(prog, fragResult.shader);
        gl!.linkProgram(prog);
        gl!.deleteShader(vertResult.shader);
        gl!.deleteShader(fragResult.shader);

        if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
            const msg = gl!.getProgramInfoLog(prog) ?? "link error";
            gl!.deleteProgram(prog);
            return { prog: null, error: { type: "link", message: msg } };
        }
        return { prog, error: null };
    }

    function sendUniform(prog: WebGLProgram, u: ShaderUniform) {
        const loc = gl!.getUniformLocation(prog, u.name);
        if (!loc) return;
        const v = u.value;
        switch (u.type) {
            case "float":
                gl!.uniform1f(loc, v as number);
                break;
            case "int":
                gl!.uniform1i(loc, v as number);
                break;
            case "bool":
                gl!.uniform1i(loc, (v as boolean) ? 1 : 0);
                break;
            case "vec2":
                gl!.uniform2fv(loc, v as number[]);
                break;
            case "vec3":
                gl!.uniform3fv(loc, v as number[]);
                break;
            case "vec4":
                gl!.uniform4fv(loc, v as number[]);
                break;
        }
    }

    function draw() {
        if (!program) {
            animFrame = requestAnimationFrame(draw);
            return;
        }
        const w = canvas.width;
        const h = canvas.height;
        gl!.viewport(0, 0, w, h);
        gl!.useProgram(program);

        gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
        const pos = gl!.getAttribLocation(program, "a_position");
        gl!.enableVertexAttribArray(pos);
        gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 0, 0);

        const t = (performance.now() - startTime) / 1000;
        const resLoc = gl!.getUniformLocation(program, "iResolution");
        if (resLoc) gl!.uniform2f(resLoc, w, h);
        const timeLoc = gl!.getUniformLocation(program, "iTime");
        if (timeLoc) gl!.uniform1f(timeLoc, t);
        const mouseLoc = gl!.getUniformLocation(program, "iMouse");
        if (mouseLoc) gl!.uniform4f(mouseLoc, mouseX, mouseY, clickX, clickY);

        for (const u of currentUniforms) {
            sendUniform(program, u);
        }

        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        animFrame = requestAnimationFrame(draw);
    }

    draw();

    return {
        updateSource(fragmentSource, uniforms) {
            const result = buildProgram(fragmentSource, uniforms);
            if (result.error) {
                currentError = result.error;
                return result.error;
            }
            if (program) gl!.deleteProgram(program);
            program = result.prog;
            currentUniforms = uniforms;
            currentError = null;
            return null;
        },

        setUniformValue(name, value) {
            currentUniforms = currentUniforms.map((u) => (u.name === name ? { ...u, value } : u));
        },

        resize(w, h) {
            canvas.width = w;
            canvas.height = h;
        },

        destroy() {
            cancelAnimationFrame(animFrame);
            if (program) gl!.deleteProgram(program);
        },

        getError() {
            return currentError;
        },
    };
}
