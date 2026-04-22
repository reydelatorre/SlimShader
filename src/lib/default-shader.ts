export const DEFAULT_FRAGMENT_SHADER = `// SlimShader — GLSL Fragment Shader
// Built-in uniforms (always available):
//   uniform float iTime;        — elapsed seconds
//   uniform vec2  iResolution;  — canvas size in pixels
//   uniform vec4  iMouse;       — xy = cursor pos, zw = click pos

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv * 2.0 - 1.0;
    c.x *= iResolution.x / iResolution.y;

    float d = length(c) - 0.4;
    float glow = 0.02 / abs(d);

    vec3 col = glow * vec3(0.48, 0.36, 0.74);
    col += smoothstep(0.01, 0.0, abs(d)) * vec3(0.6, 0.45, 0.9);

    fragColor = vec4(col, 1.0);
}
`;

export const MESH_RAYCAST_STARTER = `// Mesh raycast — Möller–Trumbore against iMesh.
// Load an OBJ in the Mesh panel. getMeshVertTransformed(i, j) returns the vertex
// centered at origin with scale + rotation applied. uNumTris = triangle count.

bool rayTri(vec3 ro, vec3 rd, vec3 a, vec3 b, vec3 c, out float t, out vec2 bary) {
    vec3 ab = b - a, ac = c - a;
    vec3 h = cross(rd, ac);
    float det = dot(ab, h);
    if (abs(det) < 1e-5) return false;
    float inv = 1.0 / det;
    vec3 s = ro - a;
    float u = dot(s, h) * inv;
    if (u < 0.0 || u > 1.0) return false;
    vec3 q = cross(s, ab);
    float v = dot(rd, q) * inv;
    if (v < 0.0 || u + v > 1.0) return false;
    t = dot(ac, q) * inv;
    bary = vec2(u, v);
    return t > 0.001;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;

    float dist = uMeshRange * 2.0;
    vec3 ro = vec3(0.0, 0.0, dist);
    vec3 rd = normalize(vec3(uv * dist, -dist));

    float tMin = 1e10;
    vec3 hitNormal = vec3(0.0);
    vec2 hitBary = vec2(0.0);
    bool hit = false;

    for (int i = 0; i < uNumTris; i++) {
        vec3 a = getMeshVertTransformed(i, 0);
        vec3 b = getMeshVertTransformed(i, 1);
        vec3 c = getMeshVertTransformed(i, 2);
        float t;
        vec2 bary;
        if (rayTri(ro, rd, a, b, c, t, bary) && t < tMin) {
            tMin = t;
            hitNormal = normalize(cross(b - a, c - a));
            hitBary = bary;
            hit = true;
        }
    }

    if (hit) {
        vec3 light = normalize(vec3(1.0, 2.0, 1.5));
        float diff = clamp(dot(hitNormal, light), 0.0, 1.0);
        vec3 col = vec3(0.08, 0.08, 0.1) + diff * vec3(0.7, 0.75, 0.85);

        float edge = min(hitBary.x, min(hitBary.y, 1.0 - hitBary.x - hitBary.y));
        float wire = 1.0 - smoothstep(0.0, 0.02, edge);

        if (uWireframe == 1) {
            fragColor = vec4(vec3(wire * 0.7 + 0.05), 1.0);
        } else if (uWireframe == 2) {
            fragColor = vec4(mix(col, vec3(0.4, 0.7, 1.0), wire * 0.85), 1.0);
        } else {
            fragColor = vec4(col, 1.0);
        }
    } else {
        fragColor = vec4(0.04, 0.04, 0.06, 1.0);
    }
}
`;

// ── Effect starters ───────────────────────────────────────────────────────
// Each is designed to work standalone or as a pass on top of iChannel0.

export const EFFECT_CHROMATIC_ABERRATION = `// Chromatic Aberration
// Splits RGB channels radially outward from the center.
// Uniforms: uStrength (0–0.02), uCenter (vec2, 0–1)

uniform float uStrength;
uniform vec2  uCenter;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv  = fragCoord / iResolution.xy;
    vec2 dir = uv - uCenter;
    float dist = length(dir);

    vec2 offset = normalize(dir + 1e-5) * dist * uStrength;

    float r = texture(iChannel0, clamp(uv + offset,       vec2(0.0), vec2(1.0))).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, clamp(uv - offset,       vec2(0.0), vec2(1.0))).b;

    fragColor = vec4(r, g, b, 1.0);
}
`;

export const EFFECT_PIXELATION = `// Pixelation
// Samples the input at reduced cell resolution.
// Uniforms: uCellSize (1–64, in pixels)

uniform float uCellSize;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float cs    = max(uCellSize, 1.0);
    vec2  cell  = floor(fragCoord / cs) * cs + cs * 0.5;
    vec2  uv    = cell / iResolution.xy;
    fragColor   = texture(iChannel0, uv);
}
`;

export const EFFECT_EDGE_DETECT = `// Edge Detect (Sobel)
// Luminance-based Sobel edge detection.
// Uniforms: uStrength (0.1–8), uThreshold (0–1), uEdgeColor (vec3), uBgColor (vec3)

uniform float uStrength;
uniform float uThreshold;
uniform vec3  uEdgeColor;
uniform vec3  uBgColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 px = 1.0 / iResolution.xy;
    vec2 uv = fragCoord / iResolution.xy;

    float tl = luma(texture(iChannel0, uv + vec2(-px.x,  px.y)).rgb);
    float tc = luma(texture(iChannel0, uv + vec2( 0.0,   px.y)).rgb);
    float tr = luma(texture(iChannel0, uv + vec2( px.x,  px.y)).rgb);
    float ml = luma(texture(iChannel0, uv + vec2(-px.x,  0.0 )).rgb);
    float mr = luma(texture(iChannel0, uv + vec2( px.x,  0.0 )).rgb);
    float bl = luma(texture(iChannel0, uv + vec2(-px.x, -px.y)).rgb);
    float bc = luma(texture(iChannel0, uv + vec2( 0.0,  -px.y)).rgb);
    float br = luma(texture(iChannel0, uv + vec2( px.x, -px.y)).rgb);

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float edge = clamp(sqrt(gx*gx + gy*gy) * uStrength, 0.0, 1.0);
    edge = edge > uThreshold ? edge : 0.0;

    fragColor = vec4(mix(uBgColor, uEdgeColor, edge), 1.0);
}
`;

export const EFFECT_CRT = `// CRT Monitor
// Scanlines, barrel distortion, and phosphor vignette.
// Uniforms: uScanlines (0–1), uBarrel (0–0.3), uVignette (0–1), uBrightness (0.5–2)

uniform float uScanlines;
uniform float uBarrel;
uniform float uVignette;
uniform float uBrightness;

vec2 barrelDistort(vec2 uv, float k) {
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    c *= 1.0 + k * r2;
    return c * 0.5 + 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = barrelDistort(uv, uBarrel);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 col = texture(iChannel0, uv);

    // Scanlines
    float line = sin(uv.y * iResolution.y * 3.14159) * 0.5 + 0.5;
    col.rgb *= mix(1.0, line, uScanlines);

    // Phosphor column mask (subtle RGB triads)
    float col3 = mod(fragCoord.x, 3.0);
    vec3 mask = vec3(
        col3 < 1.0 ? 1.0 : 0.6,
        col3 < 2.0 && col3 >= 1.0 ? 1.0 : 0.6,
        col3 >= 2.0 ? 1.0 : 0.6
    );
    col.rgb *= mix(vec3(1.0), mask, uScanlines * 0.4);

    // Vignette
    vec2 vig = uv * (1.0 - uv);
    float vignet = vig.x * vig.y * 16.0;
    col.rgb *= mix(1.0, pow(vignet, 0.25), uVignette);

    col.rgb *= uBrightness;
    fragColor = vec4(clamp(col.rgb, 0.0, 1.0), 1.0);
}
`;

export const EFFECT_DITHER = `// Ordered Dithering (Bayer 4×4)
// Reduces color depth with a Bayer matrix threshold pattern.
// Uniforms: uLevels (2–16, color steps), uStrength (0–1, dither mix)

uniform float uLevels;
uniform float uStrength;

float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int idx = y * 4 + x;
    // 4×4 Bayer matrix values (0–15) / 16
    int m[16] = int[](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
    return float(m[idx]) / 16.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = fragCoord / iResolution.xy;
    vec4 col  = texture(iChannel0, uv);
    float threshold = (bayer4(fragCoord) - 0.5) / max(uLevels, 2.0);
    vec3 dithered = floor((col.rgb + threshold) * uLevels + 0.5) / uLevels;
    fragColor = vec4(mix(col.rgb, clamp(dithered, 0.0, 1.0), uStrength), 1.0);
}
`;

// Registry for the effect library picker
export interface EffectTemplate {
    id: string;
    name: string;
    description: string;
    source: string;
    defaultUniforms: Array<{
        name: string; type: "float" | "vec2" | "vec3"; value: number | number[];
        min?: number; max?: number; step?: number; isColor?: boolean; label?: string;
    }>;
}

export const EFFECT_TEMPLATES: EffectTemplate[] = [
    {
        id: "chromatic-aberration",
        name: "Chromatic Aberration",
        description: "RGB channel split radiating from center",
        source: EFFECT_CHROMATIC_ABERRATION,
        defaultUniforms: [
            { name: "uStrength", type: "float", value: 0.005, min: 0, max: 0.02, step: 0.0005, label: "Strength" },
            { name: "uCenter",   type: "vec2",  value: [0.5, 0.5], min: 0, max: 1, step: 0.01, label: "Center" },
        ],
    },
    {
        id: "pixelation",
        name: "Pixelation",
        description: "Block-sample input at lower resolution",
        source: EFFECT_PIXELATION,
        defaultUniforms: [
            { name: "uCellSize", type: "float", value: 8, min: 1, max: 64, step: 1, label: "Cell Size" },
        ],
    },
    {
        id: "edge-detect",
        name: "Edge Detect",
        description: "Sobel luminance edge detection",
        source: EFFECT_EDGE_DETECT,
        defaultUniforms: [
            { name: "uStrength",   type: "float", value: 2.0,  min: 0.1, max: 8,   step: 0.1,  label: "Strength" },
            { name: "uThreshold",  type: "float", value: 0.1,  min: 0,   max: 1,   step: 0.01, label: "Threshold" },
            { name: "uEdgeColor",  type: "vec3",  value: [1, 1, 1], isColor: true, label: "Edge Color" },
            { name: "uBgColor",    type: "vec3",  value: [0, 0, 0], isColor: true, label: "Background" },
        ],
    },
    {
        id: "crt",
        name: "CRT Monitor",
        description: "Scanlines, barrel distortion, phosphor vignette",
        source: EFFECT_CRT,
        defaultUniforms: [
            { name: "uScanlines",   type: "float", value: 0.6,  min: 0,   max: 1,   step: 0.01, label: "Scanlines" },
            { name: "uBarrel",      type: "float", value: 0.08, min: 0,   max: 0.3, step: 0.005, label: "Barrel" },
            { name: "uVignette",    type: "float", value: 0.5,  min: 0,   max: 1,   step: 0.01, label: "Vignette" },
            { name: "uBrightness",  type: "float", value: 1.1,  min: 0.5, max: 2,   step: 0.05, label: "Brightness" },
        ],
    },
    {
        id: "dither",
        name: "Dithering",
        description: "Bayer 4×4 ordered dithering",
        source: EFFECT_DITHER,
        defaultUniforms: [
            { name: "uLevels",   type: "float", value: 4,   min: 2, max: 16, step: 1,    label: "Color Levels" },
            { name: "uStrength", type: "float", value: 1.0, min: 0, max: 1,  step: 0.01, label: "Strength" },
        ],
    },
];

export const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// #version 300 es must be the literal first line — keep it at the top of this string.
export const FRAGMENT_WRAPPER_PREFIX = `#version 300 es
precision highp float;
precision highp int;

out vec4 _slimOut;
#define gl_FragColor _slimOut
#define texture2D texture

uniform float     iTime;
uniform vec2      iResolution;
uniform vec4      iMouse;
uniform sampler2D iChannel0;
`;

// Injected only when a mesh is loaded — keeps regular shaders lean.
export const MESH_FRAGMENT_PREFIX = `
uniform sampler2D iMesh;
uniform vec3      uMeshMin;
uniform float     uMeshRange;
uniform int       uMeshHeight;
uniform int       uNumTris;
uniform float     uMeshScale;
uniform float     uMeshRotX;
uniform float     uMeshRotY;
uniform float     uMeshRotZ;
uniform int       uWireframe;

mat3 _rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,-s,0.,s,c);}
mat3 _rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s,0.,1.,0.,-s,0.,c);}
mat3 _rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0.,s,c,0.,0.,0.,1.);}

vec3 getMeshVert(int triIdx, int vertIdx) {
    int fi = triIdx * 3 + vertIdx;
    return texelFetch(iMesh, ivec2(fi % 1024, fi / 1024), 0).rgb * uMeshRange + uMeshMin;
}

vec3 getMeshVertTransformed(int triIdx, int vertIdx) {
    vec3 p = getMeshVert(triIdx, vertIdx);
    p -= uMeshMin + vec3(uMeshRange * 0.5);
    p = _rotX(uMeshRotX) * _rotY(uMeshRotY) * _rotZ(uMeshRotZ) * p;
    return p * uMeshScale;
}
`;

export const FRAGMENT_WRAPPER_SUFFIX = `
void main() {
    vec4 fragColor;
    mainImage(fragColor, gl_FragCoord.xy);
    _slimOut = fragColor;
}
`;
