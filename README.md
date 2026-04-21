# SlimShader

A browser-based GLSL fragment shader editor with real-time WebGL preview and one-click Love2D export.

## Features

- **GLSL editor** — Monaco-powered with syntax highlighting, autocomplete for built-ins, and Shadertoy-style `mainImage` entry point
- **Live preview** — WebGL canvas that recompiles on every keystroke; compile errors surfaced inline
- **Custom uniforms** — Add `float`, `int`, `bool`, `vec2/3/4` uniforms with sliders and live value editing
- **Built-in uniforms** — `iTime`, `iResolution`, and `iMouse` always available without configuration
- **Love2D export** — Converts your shader to Love2D-compatible GLSL and generates `shader.glsl`, `main.lua`, and `conf.lua`; download as a ready-to-run `.zip`
- **Persistent library** — Shaders are saved to localStorage; pick up where you left off

## Shader format

Write a standard `mainImage` function:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, sin(iTime) * 0.5 + 0.5, 1.0);
}
```

The editor wraps this automatically for both the WebGL preview and the Love2D export.

## Love2D export

The exported zip contains:

| File | Purpose |
|---|---|
| `shader.glsl` | GLSL converted to Love2D's `effect()` format |
| `main.lua` | Boilerplate with `love.load`, `love.update`, `love.draw` |
| `conf.lua` | Window config (800×600, resizable) |
| `README.md` | Notes on custom uniforms |

Run it with `love .` inside the extracted folder.

## Dev

```
npm install
npm run dev
```

## Stack

- TanStack Router (file-based)
- React 19 + TypeScript
- Vite + Tailwind CSS v4
- Monaco Editor
- Zustand (persist)
- JSZip + file-saver
