import type { ShaderUniform } from "./shader-store";

export interface ShaderToy {
    name: string;
    description: string;
    color: string;
    source: string;
    uniforms: ShaderUniform[];
}

export const SHADER_TOYS: ShaderToy[] = [
    // ─────────────────────────────────────────────
    // 1. Plasma Warp
    // ─────────────────────────────────────────────
    {
        name: "Plasma Warp",
        description: "Domain-warped value noise with cycling hue",
        color: "#a855f7",
        uniforms: [
            { name: "uSpeed", type: "float", value: 0.4, min: 0.0, max: 2.0, step: 0.01 },
            { name: "uWarpStrength", type: "float", value: 4.0, min: 0.5, max: 10.0, step: 0.1 },
            { name: "uHueSpeed", type: "float", value: 0.1, min: 0.0, max: 0.5, step: 0.01 },
            { name: "uSaturation", type: "float", value: 0.7, min: 0.0, max: 1.0, step: 0.01 },
        ],
        source: `float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

vec3 hsv(float h, float s, float v) {
    vec3 k = vec3(1.0, 2.0 / 3.0, 1.0 / 3.0);
    vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0);
    return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * uSpeed;

    vec2 q = vec2(
        vnoise(uv + t),
        vnoise(uv + vec2(5.2, 1.3))
    );
    vec2 r = vec2(
        vnoise(uv + uWarpStrength * q + vec2(1.7, 9.2) + t * 0.5),
        vnoise(uv + uWarpStrength * q + vec2(8.3, 2.8) + t * 0.3)
    );

    float f = vnoise(uv + uWarpStrength * r);
    float hue = f * 0.5 + t * uHueSpeed;
    float sat = uSaturation + (1.0 - uSaturation) * vnoise(uv * 2.0 + t);
    float val = 0.5 + 0.5 * f;

    fragColor = vec4(hsv(hue, sat, val), 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 2. Halftone Screen
    // ─────────────────────────────────────────────
    {
        name: "Halftone Screen",
        description: "Luminance-driven halftone dots with multi-color palette",
        color: "#06b6d4",
        uniforms: [
            { name: "uCellSize",   type: "float", value: 14.0,             min: 4.0, max: 40.0, step: 0.5  },
            { name: "uSpeed",      type: "float", value: 0.6,              min: 0.0, max: 2.0,  step: 0.01 },
            { name: "uDotFill",    type: "float", value: 0.48,             min: 0.1, max: 0.8,  step: 0.01 },
            { name: "uEdgeSoft",   type: "float", value: 1.2,              min: 0.0, max: 4.0,  step: 0.1  },
            { name: "uColorCount", type: "float", value: 6.0,              min: 2.0, max: 6.0,  step: 1.0  },
            { name: "uRandomize",  type: "bool",  value: false },
            { name: "uColor0",     type: "vec3",  value: [0.0, 0.6, 0.9], isColor: true },
            { name: "uColor1",     type: "vec3",  value: [0.9, 0.1, 0.5], isColor: true },
            { name: "uColor2",     type: "vec3",  value: [0.1, 0.9, 0.5], isColor: true },
            { name: "uColor3",     type: "vec3",  value: [0.9, 0.8, 0.1], isColor: true },
            { name: "uColor4",     type: "vec3",  value: [0.7, 0.1, 0.9], isColor: true },
            { name: "uColor5",     type: "vec3",  value: [1.0, 0.4, 0.1], isColor: true },
        ],
        source: `float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float plasma(vec2 uv, float t) {
    return (sin(uv.x * 3.0 + t) + sin(uv.y * 2.5 - t * 0.7)
          + sin((uv.x + uv.y) * 2.0 + t * 0.5)
          + sin(length(uv - 0.5) * 6.0 - t * 1.2)) * 0.25 + 0.5;
}

// select from up to 6 named color slots by float index
vec3 pickColor(float i) {
    float n = mod(floor(i), uColorCount);
    if (n < 0.5) return uColor0;
    if (n < 1.5) return uColor1;
    if (n < 2.5) return uColor2;
    if (n < 3.5) return uColor3;
    if (n < 4.5) return uColor4;
    return uColor5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    float t = iTime * uSpeed;

    vec2 cell = floor(fragCoord / uCellSize);
    vec2 cellCenter = (cell + 0.5) * uCellSize;

    float lum = plasma(cellCenter / res, t);
    float radius = lum * uCellSize * uDotFill;
    float dot_ = smoothstep(radius, radius - uEdgeSoft, length(fragCoord - cellCenter));

    vec3 col;
    if (uRandomize) {
        col = pickColor(floor(hash(cell) * uColorCount));
    } else {
        float pos = fract(lum + hash(cell) * 0.15) * (uColorCount - 1.0);
        col = mix(pickColor(floor(pos)), pickColor(floor(pos) + 1.0), fract(pos));
    }

    fragColor = vec4(col * dot_, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 3. CRT Phosphor
    // ─────────────────────────────────────────────
    {
        name: "CRT Phosphor",
        description: "RGB subpixel grid, scanlines, and barrel distortion",
        color: "#22c55e",
        uniforms: [
            { name: "uBarrel", type: "float", value: 0.15, min: 0.0, max: 0.5, step: 0.01 },
            { name: "uScanSpeed", type: "float", value: 80.0, min: 0.0, max: 200.0, step: 1.0 },
            { name: "uScanDepth", type: "float", value: 0.15, min: 0.0, max: 0.5, step: 0.01 },
            { name: "uVignette", type: "float", value: 18.0, min: 1.0, max: 40.0, step: 0.5 },
        ],
        source: `vec2 barrel(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    uv *= 1.0 + r2 * (uBarrel + r2 * uBarrel * 0.33);
    return uv * 0.5 + 0.5;
}

float scanline(float y, float t) {
    float line = mod(y + t * uScanSpeed, 3.0);
    return (1.0 - uScanDepth) + uScanDepth * smoothstep(2.5, 3.0, line);
}

vec3 phosphor(vec2 uv) {
    float t = iTime;
    float r = sin(uv.x * 8.0 + t) * 0.5 + 0.5;
    float g = sin(uv.x * 8.0 + t + 2.094) * 0.5 + 0.5;
    float b = sin(uv.x * 8.0 + t + 4.189) * 0.5 + 0.5;
    r *= sin(uv.y * 5.0 - t * 0.7) * 0.5 + 0.5;
    g *= sin(uv.y * 5.0 - t * 0.7 + 1.0) * 0.5 + 0.5;
    b *= sin(uv.y * 5.0 - t * 0.7 + 2.0) * 0.5 + 0.5;
    return vec3(r, g, b);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = barrel(fragCoord / iResolution.xy);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 col = phosphor(uv);

    float px = mod(fragCoord.x, 3.0);
    vec3 mask = vec3(
        smoothstep(0.0, 0.5, px) * (1.0 - smoothstep(0.5, 1.0, px)),
        smoothstep(1.0, 1.5, px) * (1.0 - smoothstep(1.5, 2.0, px)),
        smoothstep(2.0, 2.5, px) * (1.0 - smoothstep(2.5, 3.0, px))
    );
    col *= 0.4 + 0.6 * mask;

    col *= scanline(fragCoord.y, iTime);

    vec2 vig = uv * (1.0 - uv.yx);
    col *= pow(vig.x * vig.y * uVignette, 0.25);

    fragColor = vec4(col, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 4. Turbulence Fluid
    // ─────────────────────────────────────────────
    {
        name: "Turbulence Fluid",
        description: "XorDev turbulence — layered rotated sine waves warp UV space",
        color: "#f97316",
        uniforms: [
            { name: "uSpeed",  type: "float", value: 0.3,               min: 0.0, max: 1.5, step: 0.01 },
            { name: "uScale",  type: "float", value: 1.2,               min: 0.2, max: 4.0, step: 0.05 },
            { name: "uAmp",    type: "float", value: 0.7,               min: 0.1, max: 2.0, step: 0.05 },
            { name: "uGrowth", type: "float", value: 1.4,               min: 1.1, max: 2.5, step: 0.05 },
            { name: "uColorA", type: "vec3",  value: [0.1, 0.2, 0.8],  isColor: true },
            { name: "uColorB", type: "vec3",  value: [0.9, 0.1, 0.5],  isColor: true },
            { name: "uColorC", type: "vec3",  value: [0.0, 0.8, 0.6],  isColor: true },
        ],
        source: `// Based on XorDev's "Turbulent Dark" — https://mini.gmshaders.com/p/turbulence
vec2 turbulence(vec2 p, float t) {
    float freq  = 2.0;
    float angle = 0.0;
    for (int i = 0; i < 8; i++) {
        float c = sin(angle + 1.5707963);
        float s = sin(angle);
        float phase = freq * (p.x * s + p.y * c) + t + float(i);
        float disp  = uAmp * sin(phase) / freq;
        p.x += disp * c;
        p.y -= disp * s;
        angle += 0.9272952;
        freq  *= uGrowth;
    }
    return p;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * uSpeed;
    vec2 w = turbulence(uv * uScale, t);

    float h1 = sin(w.x * 3.0 + t) * 0.5 + 0.5;
    float h2 = sin(w.y * 2.5 - t * 0.7) * 0.5 + 0.5;
    vec3 col = mix(mix(uColorA, uColorB, h1), uColorC, h2);
    fragColor = vec4(col, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 5. Chromatic Interference
    // ─────────────────────────────────────────────
    {
        name: "Chromatic Interference",
        description: "RGB-split interference field",
        color: "#ec4899",
        uniforms: [
            { name: "uFreq", type: "float", value: 8.0, min: 1.0, max: 20.0, step: 0.1 },
            { name: "uTwist", type: "float", value: 1.0, min: 0.0, max: 4.0, step: 0.05 },
            { name: "uShift", type: "float", value: 0.025, min: 0.0, max: 0.1, step: 0.001 },
            { name: "uSpeed", type: "float", value: 0.5, min: 0.0, max: 2.0, step: 0.01 },
        ],
        source: `float field(vec2 uv, float freq, float t, float phase) {
    float a = sin(uv.x * freq + t + phase);
    float b = sin(uv.y * freq * 0.8 - t * 0.9 + phase * 1.3);
    float c = sin(length(uv) * freq * 0.6 + t * 1.1);
    return a * b + c * 0.4;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * uSpeed;

    vec2 uvR = uv + vec2(uShift,  0.0);
    vec2 uvB = uv - vec2(uShift,  0.0);

    float r = field(uvR, uFreq,        t,          0.0  ) * 0.5 + 0.5;
    float g = field(uv,  uFreq * 0.95, t + uTwist, 2.094) * 0.5 + 0.5;
    float b = field(uvB, uFreq,        t,          4.189) * 0.5 + 0.5;

    r = pow(r, 1.4);
    g = pow(g, 1.2);
    b = pow(b, 1.6);

    fragColor = vec4(r, g, b, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 6. Bayer Dither
    // ─────────────────────────────────────────────
    {
        name: "Bayer Dither",
        description: "Ordered dithering — variable matrix size and pixel dimensions",
        color: "#eab308",
        uniforms: [
            { name: "uMatrixBits", type: "float", value: 2.0,              min: 1.0, max: 3.0,  step: 1.0  },
            { name: "uPixelSize",  type: "float", value: 2.0,              min: 1.0, max: 16.0, step: 1.0  },
            { name: "uLevels",     type: "float", value: 4.0,              min: 2.0, max: 16.0, step: 1.0  },
            { name: "uSpeed",      type: "float", value: 0.3,              min: 0.0, max: 1.0,  step: 0.01 },
            { name: "uFreqX",      type: "float", value: 4.0,              min: 0.5, max: 12.0, step: 0.1  },
            { name: "uFreqY",      type: "float", value: 3.0,              min: 0.5, max: 12.0, step: 0.1  },
            { name: "uColorA",     type: "vec3",  value: [0.05, 0.05, 0.3], isColor: true },
            { name: "uColorB",     type: "vec3",  value: [0.8, 0.1, 0.6],  isColor: true },
            { name: "uColorC",     type: "vec3",  value: [0.9, 0.7, 0.1],  isColor: true },
        ],
        source: `// Bayer threshold for matrices up to 8x8 (uMatrixBits: 1=2x2, 2=4x4, 3=8x8)
// Accumulates XOR-based bit levels in float arithmetic (GLSL ES 1.00)
float bayer(vec2 p) {
    float N = pow(2.0, uMatrixBits);
    float x = mod(p.x, N), y = mod(p.y, N);
    float x0 = mod(x, 2.0),           y0 = mod(y, 2.0);
    float x1 = mod(floor(x * 0.5), 2.0), y1 = mod(floor(y * 0.5), 2.0);
    float x2 = mod(floor(x * 0.25), 2.0), y2 = mod(floor(y * 0.25), 2.0);
    float v = (2.0 * mod(x0 + y0, 2.0) + y0)
            +  4.0 * step(2.0, uMatrixBits) * (2.0 * mod(x1 + y1, 2.0) + y1)
            + 16.0 * step(3.0, uMatrixBits) * (2.0 * mod(x2 + y2, 2.0) + y2);
    return v / (N * N);
}

vec3 palette(float t) {
    return t < 0.5 ? mix(uColorA, uColorB, t * 2.0) : mix(uColorB, uColorC, t * 2.0 - 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = floor(fragCoord / uPixelSize) * uPixelSize / iResolution.xy;
    float wave = sin(uv.x * uFreqX + iTime * uSpeed) * 0.25
               + sin(uv.y * uFreqY - iTime * uSpeed * 0.8) * 0.25 + 0.5;
    vec3 src = palette(wave);
    float t = bayer(fragCoord), s = 1.0 / uLevels;
    vec3 lo = floor(src * uLevels) / uLevels, f = (src - lo) * uLevels;
    fragColor = vec4(f.r > t ? lo.r + s : lo.r,
                     f.g > t ? lo.g + s : lo.g,
                     f.b > t ? lo.b + s : lo.b, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 7. Bloom Edge Grid
    // ─────────────────────────────────────────────
    {
        name: "Bloom Edge Grid",
        description: "Glowing sine-wave grid lines with bloom falloff",
        color: "#38bdf8",
        uniforms: [
            { name: "uSpeed",    type: "float", value: 0.4,              min: 0.0,   max: 2.0,  step: 0.01  },
            { name: "uRepeat",   type: "float", value: 6.0,              min: 1.0,   max: 20.0, step: 0.5   },
            { name: "uEdge",     type: "float", value: 0.012,            min: 0.001, max: 0.1,  step: 0.001 },
            { name: "uExponent", type: "float", value: 1.4,              min: 0.5,   max: 4.0,  step: 0.1   },
            { name: "uColor",    type: "vec3",  value: [0.2, 0.8, 1.0], isColor: true },
        ],
        source: `// Ported from bloom-edge-pattern.ts + bloom.ts + repeating-pattern.ts (Three TSL)
float repPattern(float p, float repeat, float t) {
    return sin(p * repeat + t) / repeat;
}

float bloomEdge(float p, float edge, float exponent) {
    return pow(edge / max(abs(p), 0.00001), exponent);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * uSpeed;

    float px = repPattern(uv.x, uRepeat, t);
    float py = repPattern(uv.y, uRepeat, t * 0.7 + 1.5708);

    float bx = clamp(bloomEdge(px, uEdge, uExponent), 0.0, 1.0);
    float by = clamp(bloomEdge(py, uEdge, uExponent), 0.0, 1.0);
    float b  = max(bx, by);

    fragColor = vec4(uColor * b, 1.0);
}`,
    },

    // ─────────────────────────────────────────────
    // 8. Ridge Noise
    // ─────────────────────────────────────────────
    {
        name: "Ridge Noise",
        description: "Fractal ridge noise — sharp peaks, soft valleys",
        color: "#84cc16",
        uniforms: [
            { name: "uSpeed",     type: "float", value: 0.08,              min: 0.0, max: 0.5,  step: 0.005 },
            { name: "uScale",     type: "float", value: 3.0,               min: 0.5, max: 8.0,  step: 0.1   },
            { name: "uColorLow",  type: "vec3",  value: [0.05, 0.08, 0.2], isColor: true },
            { name: "uColorMid",  type: "vec3",  value: [0.3, 0.55, 0.4],  isColor: true },
            { name: "uColorHigh", type: "vec3",  value: [0.95, 0.95, 0.9], isColor: true },
        ],
        source: `// Ported from ridge-noise.ts (Three TSL)
float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float ridge(vec2 p) {
    float v = 0.0, amp = 0.5, freq = 1.0, w = 1.0;
    for (int i = 0; i < 6; i++) {
        float n = 1.0 - abs(vnoise(p * freq) * 2.0 - 1.0);
        n = n * n * w;
        v += n * amp;
        w = clamp(n, 0.0, 1.0);
        freq *= 2.0;
        amp  *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * uSpeed;
    float h = ridge(uv * uScale + vec2(t, t * 0.4));

    vec3 col;
    if (h < 0.5) {
        col = mix(uColorLow, uColorMid, h * 2.0);
    } else {
        col = mix(uColorMid, uColorHigh, h * 2.0 - 1.0);
    }
    fragColor = vec4(col, 1.0);
}`,
    },
];
