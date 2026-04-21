import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FRAGMENT_SHADER } from "./default-shader";

export type UniformType = "float" | "vec2" | "vec3" | "vec4" | "bool" | "int" | "sampler2D";

export interface ShaderUniform {
    name: string;
    type: UniformType;
    value: number | number[] | boolean;
    min?: number;
    max?: number;
    step?: number;
}

export interface ShaderEntry {
    id: string;
    name: string;
    fragmentSource: string;
    uniforms: ShaderUniform[];
    createdAt: number;
    updatedAt: number;
}

interface ShaderState {
    shaders: ShaderEntry[];
    createShader: () => string;
    updateShader: (id: string, patch: Partial<Omit<ShaderEntry, "id" | "createdAt">>) => void;
    deleteShader: (id: string) => void;
    getShader: (id: string) => ShaderEntry | undefined;
    addUniform: (shaderId: string, uniform: ShaderUniform) => void;
    updateUniform: (shaderId: string, name: string, patch: Partial<ShaderUniform>) => void;
    removeUniform: (shaderId: string, name: string) => void;
}

function makeId() {
    return Math.random().toString(36).slice(2, 10);
}

export const useShaderStore = create<ShaderState>()(
    persist(
        (set, get) => ({
            shaders: [],

            createShader() {
                const id = makeId();
                const now = Date.now();
                const entry: ShaderEntry = {
                    id,
                    name: "Untitled Shader",
                    fragmentSource: DEFAULT_FRAGMENT_SHADER,
                    uniforms: [],
                    createdAt: now,
                    updatedAt: now,
                };
                set((s) => ({ shaders: [entry, ...s.shaders] }));
                return id;
            },

            updateShader(id, patch) {
                set((s) => ({
                    shaders: s.shaders.map((sh) =>
                        sh.id === id ? { ...sh, ...patch, updatedAt: Date.now() } : sh
                    ),
                }));
            },

            deleteShader(id) {
                set((s) => ({ shaders: s.shaders.filter((sh) => sh.id !== id) }));
            },

            getShader(id) {
                return get().shaders.find((sh) => sh.id === id);
            },

            addUniform(shaderId, uniform) {
                set((s) => ({
                    shaders: s.shaders.map((sh) =>
                        sh.id === shaderId
                            ? { ...sh, uniforms: [...sh.uniforms, uniform], updatedAt: Date.now() }
                            : sh
                    ),
                }));
            },

            updateUniform(shaderId, name, patch) {
                set((s) => ({
                    shaders: s.shaders.map((sh) =>
                        sh.id === shaderId
                            ? {
                                  ...sh,
                                  uniforms: sh.uniforms.map((u) =>
                                      u.name === name ? { ...u, ...patch } : u
                                  ),
                                  updatedAt: Date.now(),
                              }
                            : sh
                    ),
                }));
            },

            removeUniform(shaderId, name) {
                set((s) => ({
                    shaders: s.shaders.map((sh) =>
                        sh.id === shaderId
                            ? {
                                  ...sh,
                                  uniforms: sh.uniforms.filter((u) => u.name !== name),
                                  updatedAt: Date.now(),
                              }
                            : sh
                    ),
                }));
            },
        }),
        { name: "slimshader-store" }
    )
);
