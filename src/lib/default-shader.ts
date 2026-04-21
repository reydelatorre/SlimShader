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

export const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_WRAPPER_PREFIX = `
precision mediump float;
uniform float     iTime;
uniform vec2      iResolution;
uniform vec4      iMouse;
uniform sampler2D iChannel0;
`;

export const FRAGMENT_WRAPPER_SUFFIX = `
void main() {
    vec4 fragColor;
    mainImage(fragColor, gl_FragCoord.xy);
    gl_FragColor = fragColor;
}
`;
