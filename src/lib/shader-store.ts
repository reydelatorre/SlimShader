import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FRAGMENT_SHADER } from "./default-shader";
import { syncEntry, deleteRemoteShader } from "./supabase-sync";

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
    published: boolean;
    createdAt: number;
    updatedAt: number;
}

interface ShaderState {
    shaders: ShaderEntry[];
    createShader: () => string;
    updateShader: (id: string, patch: Partial<Omit<ShaderEntry, "id" | "createdAt">>) => void;
    deleteShader: (id: string) => void;
    getShader: (id: string) => ShaderEntry | undefined;
    setPublished: (id: string, published: boolean) => void;
    addUniform: (shaderId: string, uniform: ShaderUniform) => void;
    updateUniform: (shaderId: string, name: string, patch: Partial<ShaderUniform>) => void;
    removeUniform: (shaderId: string, name: string) => void;
    seedFromRemote: (entries: ShaderEntry[]) => void;
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
                    published: false,
                    createdAt: now,
                    updatedAt: now,
                };
                set((s) => ({ shaders: [entry, ...s.shaders] }));
                syncEntry(entry);
                return id;
            },

            updateShader(id, patch) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== id) return sh;
                        updated = { ...sh, ...patch, updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            deleteShader(id) {
                set((s) => ({ shaders: s.shaders.filter((sh) => sh.id !== id) }));
                deleteRemoteShader(id);
            },

            getShader(id) {
                return get().shaders.find((sh) => sh.id === id);
            },

            setPublished(id, published) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== id) return sh;
                        updated = { ...sh, published, updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            addUniform(shaderId, uniform) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        updated = {
                            ...sh,
                            uniforms: [...sh.uniforms, uniform],
                            updatedAt: Date.now(),
                        };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            updateUniform(shaderId, name, patch) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        updated = {
                            ...sh,
                            uniforms: sh.uniforms.map((u) =>
                                u.name === name ? { ...u, ...patch } : u
                            ),
                            updatedAt: Date.now(),
                        };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            removeUniform(shaderId, name) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        updated = {
                            ...sh,
                            uniforms: sh.uniforms.filter((u) => u.name !== name),
                            updatedAt: Date.now(),
                        };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            seedFromRemote(entries) {
                set((s) => {
                    const map = new Map(s.shaders.map((sh) => [sh.id, sh]));
                    for (const remote of entries) {
                        const local = map.get(remote.id);
                        if (!local || remote.updatedAt > local.updatedAt) {
                            map.set(remote.id, remote);
                        }
                    }
                    return {
                        shaders: Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt),
                    };
                });
            },
        }),
        {
            name: "slimshader-store",
            version: 1,
            migrate(state: unknown, version: number) {
                const s = state as { shaders: ShaderEntry[] };
                if (version === 0) {
                    s.shaders = s.shaders.map((sh) => ({ ...sh, published: sh.published ?? false }));
                }
                return s;
            },
        }
    )
);
