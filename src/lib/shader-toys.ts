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
            { name: "uSpeed",        type: "float", value: 0.4,  min: 0.0, max: 2.0,  step: 0.01 },
            { name: "uWarpStrength", type: "float", value: 4.0,  min: 0.5, max: 10.0, step: 0.1  },
            { name: "uHueSpeed",     type: "float", value: 0.1,  min: 0.0, max: 0.5,  step: 0.01 },
            { name: "uSaturation",   type: "float", value: 0.7,  min: 0.0, max: 1.0,  step: 0.01 },
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
        description: "Luminance-driven halftone dots with color tinting",
        color: "#06b6d4",
        uniforms: [
            { name: "uCellSize",  type: "float", value: 14.0, min: 4.0,  max: 40.0, step: 0.5  },
            { name: "uSpeed",     type: "float", value: 0.6,  min: 0.0,  max: 2.0,  step: 0.01 },
            { name: "uDotFill",   type: "float", value: 0.48, min: 0.1,  max: 0.8,  step: 0.01 },
            { name: "uEdgeSoft",  type: "float", value: 1.2,  min: 0.0,  max: 4.0,  step: 0.1  },
        ],
        source: `float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float plasma(vec2 uv, float t) {
    float a = sin(uv.x * 3.0 + t);
    float b = sin(uv.y * 2.5 - t * 0.7);
    float c = sin((uv.x + uv.y) * 2.0 + t * 0.5);
    float d = sin(length(uv - 0.5) * 6.0 - t * 1.2);
    return (a + b + c + d) * 0.25 + 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    float t = iTime * uSpeed;

    vec2 cell = floor(fragCoord / uCellSize);
    vec2 cellCenter = (cell + 0.5) * uCellSize;
    vec2 cellUV = cellCenter / res;

    float lum = plasma(cellUV, t);
    float radius = lum * uCellSize * uDotFill;

    float dist = length(fragCoord - cellCenter);
    float dot_ = smoothstep(radius, radius - uEdgeSoft, dist);

    float hshift = hash(cell) * 0.15;
    vec3 col = mix(
        vec3(0.0, 0.6, 0.9),
        vec3(0.9, 0.1, 0.5),
        fract(lum + hshift)
    );

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
            { name: "uBarrel",     type: "float", value: 0.15, min: 0.0,  max: 0.5,   step: 0.01  },
            { name: "uScanSpeed", type: "float", value: 80.0, min: 0.0,  max: 200.0, step: 1.0   },
            { name: "uScanDepth", type: "float", value: 0.15, min: 0.0,  max: 0.5,   step: 0.01  },
            { name: "uVignette",  type: "float", value: 18.0, min: 1.0,  max: 40.0,  step: 0.5   },
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
    // 4. Voronoi Pulse
    // ─────────────────────────────────────────────
    {
        name: "Voronoi Pulse",
        description: "Animated Voronoi cells with glowing edges",
        color: "#f97316",
        uniforms: [
            { name: "uScale",     type: "float", value: 4.5,  min: 1.0,  max: 12.0, step: 0.1  },
            { name: "uSpeed",     type: "float", value: 0.5,  min: 0.0,  max: 2.0,  step: 0.01 },
            { name: "uEdgeGlow",  type: "float", value: 12.0, min: 1.0,  max: 30.0, step: 0.5  },
            { name: "uPulseRate", type: "float", value: 2.0,  min: 0.0,  max: 6.0,  step: 0.1  },
        ],
        source: `vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 uv, float t, out float edge) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float minDist  = 9.0;
    float minDist2 = 9.0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 h = hash2(i + neighbor);
            vec2 point = neighbor + h + 0.5 * sin(h * 6.28318 + t);
            float d = length(f - point);
            if (d < minDist) {
                minDist2 = minDist;
                minDist = d;
            } else if (d < minDist2) {
                minDist2 = d;
            }
        }
    }
    edge = minDist2 - minDist;
    return minDist;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;
    uv *= uScale;

    float t = iTime * uSpeed;
    float edge;
    float d = voronoi(uv, t, edge);

    vec2 cellId = hash2(floor(uv + hash2(floor(uv))));
    vec3 cellCol = 0.5 + 0.5 * sin(vec3(
        cellId.x * 6.28318,
        cellId.y * 6.28318 + 2.094,
        (cellId.x + cellId.y) * 6.28318 + 4.189
    ) + t);

    float glow = exp(-edge * uEdgeGlow);
    vec3 glowCol = vec3(1.0, 0.6, 0.1) * glow;

    float pulse = 0.6 + 0.4 * sin(cellId.x * 20.0 + iTime * uPulseRate);
    vec3 col = cellCol * pulse * 0.5 + glowCol;
    col *= 0.5 + 0.5 * smoothstep(0.0, 0.4, d);

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
            { name: "uFreq",     type: "float", value: 8.0,   min: 1.0,  max: 20.0, step: 0.1  },
            { name: "uTwist",    type: "float", value: 1.0,   min: 0.0,  max: 4.0,  step: 0.05 },
            { name: "uShift",    type: "float", value: 0.025, min: 0.0,  max: 0.1,  step: 0.001 },
            { name: "uSpeed",    type: "float", value: 0.5,   min: 0.0,  max: 2.0,  step: 0.01 },
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
        description: "4x4 ordered dithering on an animated gradient",
        color: "#eab308",
        uniforms: [
            { name: "uLevels", type: "float", value: 4.0,  min: 2.0,  max: 16.0, step: 1.0  },
            { name: "uSpeed",  type: "float", value: 0.3,  min: 0.0,  max: 1.0,  step: 0.01 },
            { name: "uFreqX",  type: "float", value: 4.0,  min: 0.5,  max: 12.0, step: 0.1  },
            { name: "uFreqY",  type: "float", value: 3.0,  min: 0.5,  max: 12.0, step: 0.1  },
        ],
        source: `// 4x4 Bayer threshold in float arithmetic (GLSL ES 1.00 compatible)
float bayerThreshold(vec2 p) {
    float x  = mod(p.x, 4.0);
    float y  = mod(p.y, 4.0);
    float x0 = mod(x, 2.0);
    float x1 = floor(x / 2.0);
    float y0 = mod(y, 2.0);
    float y1 = floor(y / 2.0);
    float v  = 8.0 * mod(x0 + y0, 2.0)
             + 4.0 * y0
             + 2.0 * mod(x1 + y1, 2.0)
             + y1;
    return v / 16.0;
}

vec3 palette(float t) {
    vec3 a = vec3(0.05, 0.05, 0.3);
    vec3 b = vec3(0.8,  0.1,  0.6);
    vec3 c = vec3(0.9,  0.7,  0.1);
    if (t < 0.5) return mix(a, b, t * 2.0);
    return mix(b, c, (t - 0.5) * 2.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime * uSpeed;
    vec2 uv = fragCoord / iResolution.xy;

    float wave = sin(uv.x * uFreqX + t) * 0.25
               + sin(uv.y * uFreqY - t * 0.8) * 0.25
               + 0.5;
    vec3 src = palette(wave);

    float thresh = bayerThreshold(fragCoord);
    float step_  = 1.0 / uLevels;
    vec3  lo     = floor(src * uLevels) / uLevels;
    vec3  hi     = lo + step_;
    vec3  frac_  = (src - lo) * uLevels;

    vec3 col;
    col.r = frac_.r > thresh ? hi.r : lo.r;
    col.g = frac_.g > thresh ? hi.g : lo.g;
    col.b = frac_.b > thresh ? hi.b : lo.b;

    fragColor = vec4(col, 1.0);
}`,
    },
];
