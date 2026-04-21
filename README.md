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

## Tutorials

### Your first shader

1. Sign in and click **New Shader** from the home screen.
2. The editor opens with a default glowing circle. The left pane is your GLSL, the center is the live WebGL preview.
3. Edit the `mainImage` function — the preview recompiles on every keystroke.
4. Built-in uniforms are always available: `iTime` (seconds elapsed), `iResolution` (canvas size), `iMouse` (cursor + click position).

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, sin(iTime) * 0.5 + 0.5, 1.0);
}
```

---

### Adding custom uniforms

1. Open the **Uniforms** tab in the right panel.
2. Type a name (e.g. `uSpeed`) into the **new uniform name** field, pick a type (`float`, `vec3`, etc.), and click **Add Uniform** or press Enter.
3. A slider and value field appear immediately — drag or type to change the value live.
4. For `float` / `int` uniforms, adjust the **min** and **max** bounds below the slider.
5. For `vec3` / `vec4`, check the **color** checkbox to get a full color picker (HSV square, hue strip, RGB inputs, hex).
6. Reference the uniform by name in your GLSL — no `uniform` declaration needed, SlimShader injects it automatically.

```glsl
uniform float uSpeed;   // declared for you — just use it
float t = iTime * uSpeed;
```

---

### Using starter shaders

1. On the home screen, click any card in the **Starter Shaders** grid (Plasma Warp, Halftone Screen, CRT Phosphor, etc.).
2. A new shader is created in your library, pre-loaded with the effect's GLSL and all its parameters wired up as uniforms.
3. Open the **Uniforms** tab and tweak values — colors, speeds, scales — and see the effect update instantly.
4. Edit the GLSL directly to combine ideas or take the effect in a new direction.

---

### Stacking shaders with passes

Passes let you chain shaders together so the output of one feeds as input to the next — like effects pedals in a signal chain.

**How it works:**  
Each pass receives the previous pass's rendered frame as `iChannel0` — a `sampler2D` you can sample in GLSL:

```glsl
vec4 prev = texture2D(iChannel0, fragCoord / iResolution.xy);
```

**Setting up a chain:**

1. Open the shader you want to be the **final** effect in the chain.
2. Click the **Passes** tab in the right panel.
3. Use the dropdown to pick a shader from your library as a pre-pass, then click **Add Pass**.
4. Add as many passes as you like. Use the **↑ ↓** arrows to reorder them.
5. The current shader is always the last pass (shown at the bottom of the list and can't be removed).

**Example — dither on top of plasma:**

- Create a **Plasma Warp** shader (use the starter).
- Create a second shader that reads `iChannel0` and applies Bayer dithering to it.
- Open the dither shader, go to **Passes**, and add Plasma Warp as pass 1.
- The dither shader now processes the plasma output every frame.

```glsl
// Dither pass — receives plasma output via iChannel0
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 src = texture2D(iChannel0, uv).rgb;
    // ... apply dithering to src
    fragColor = vec4(src, 1.0);
}
```

---

### Publishing to the gallery

1. Open any shader and click the **publish** button in the top toolbar.
2. The shader appears in the public **Gallery** accessible from any page header.
3. Anyone viewing the gallery can click **fork** to copy your shader into their own library and build on it.
4. Click the button again (it shows **published**) to unpublish.

---

### Exporting for Love2D

1. Open a shader and click the **Export** tab in the right panel.
2. Click **Download .zip** — you get `shader.glsl`, `main.lua`, `conf.lua`, and a `README.md`.
3. Unzip and run `love .` inside the folder. Requires [LÖVE](https://love2d.org) 11.4+.
4. Custom uniforms are preserved — `main.lua` exposes them as variables at the top of the file for easy editing.

---

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
