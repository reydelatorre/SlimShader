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
