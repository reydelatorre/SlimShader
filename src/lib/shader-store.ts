import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FRAGMENT_SHADER } from "./default-shader";
import { syncEntry, deleteRemoteShader } from "./supabase-sync";

export type UniformType = "float" | "vec2" | "vec3" | "vec4" | "bool" | "int" | "sampler2D" | "select" | "ramp";
export type BlendMode =
    | "replace" | "mix"
    | "add" | "subtract" | "difference"
    | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light"
    | "darken" | "lighten" | "color-dodge" | "color-burn";

export interface GradientStop {
    position: number;
    color: [number, number, number];
}

export interface PostSettings {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    exposure: number;
}

export interface ShaderPass {
    id: string;
    blendMode: BlendMode;
    opacity: number;
}

export interface ShaderUniform {
    name: string;
    type: UniformType;
    value: number | number[] | boolean;
    isColor?: boolean;
    isXYPad?: boolean;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    description?: string;
    group?: string;
    options?: { label: string; value: number }[];
    visibleWhen?: { key: string; equals: number | boolean };
    stops?: GradientStop[];
}

export interface ShaderEntry {
    id: string;
    name: string;
    fragmentSource: string;
    uniforms: ShaderUniform[];
    passes: ShaderPass[];
    blendMode: BlendMode;
    blendOpacity: number;
    published: boolean;
    postProcessing?: PostSettings;
    createdAt: number;
    updatedAt: number;
}

interface ShaderState {
    shaders: ShaderEntry[];
    deletedIds: string[];
    createShader: () => string;
    updateShader: (id: string, patch: Partial<Omit<ShaderEntry, "id" | "createdAt">>) => void;
    deleteShader: (id: string) => void;
    getShader: (id: string) => ShaderEntry | undefined;
    setPublished: (id: string, published: boolean) => void;
    addUniform: (shaderId: string, uniform: ShaderUniform) => void;
    updateUniform: (shaderId: string, name: string, patch: Partial<ShaderUniform>) => void;
    removeUniform: (shaderId: string, name: string) => void;
    addPass: (shaderId: string, passId: string) => void;
    removePass: (shaderId: string, index: number) => void;
    reorderPass: (shaderId: string, from: number, to: number) => void;
    updatePass: (shaderId: string, index: number, patch: Partial<ShaderPass>) => void;
    seedFromRemote: (entries: ShaderEntry[]) => void;
}

function makeId() {
    return Math.random().toString(36).slice(2, 10);
}

export const useShaderStore = create<ShaderState>()(
    persist(
        (set, get) => ({
            shaders: [],
            deletedIds: [],

            createShader() {
                const id = makeId();
                const now = Date.now();
                const entry: ShaderEntry = {
                    id,
                    name: "Untitled Shader",
                    fragmentSource: DEFAULT_FRAGMENT_SHADER,
                    uniforms: [],
                    passes: [] as ShaderPass[],
                    blendMode: "replace",
                    blendOpacity: 1,
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
                set((s) => ({
                    shaders: s.shaders.filter((sh) => sh.id !== id),
                    // Keep last 200 deleted IDs so seedFromRemote never re-adds them
                    deletedIds: [id, ...s.deletedIds].slice(0, 200),
                }));
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

            addPass(shaderId, passId) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        const newPass: ShaderPass = { id: passId, blendMode: "replace", opacity: 1 };
                        updated = { ...sh, passes: [...(sh.passes ?? []), newPass], updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            removePass(shaderId, index) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        updated = { ...sh, passes: (sh.passes ?? []).filter((_, i) => i !== index), updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            reorderPass(shaderId, from, to) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        const next = [...(sh.passes ?? [])];
                        const temp = next[from];
                        next[from] = next[to];
                        next[to] = temp;
                        updated = { ...sh, passes: next, updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            updatePass(shaderId, index, patch) {
                let updated: ShaderEntry | undefined;
                set((s) => ({
                    shaders: s.shaders.map((sh) => {
                        if (sh.id !== shaderId) return sh;
                        const passes = [...(sh.passes ?? [])];
                        passes[index] = { ...passes[index], ...patch };
                        updated = { ...sh, passes, updatedAt: Date.now() };
                        return updated;
                    }),
                }));
                if (updated) syncEntry(updated);
            },

            seedFromRemote(entries) {
                set((s) => {
                    const deleted = new Set(s.deletedIds);
                    const map = new Map(s.shaders.map((sh) => [sh.id, sh]));
                    for (const remote of entries) {
                        if (deleted.has(remote.id)) continue;
                        const local = map.get(remote.id);
                        if (!local || remote.updatedAt > local.updatedAt) {
                            map.set(remote.id, {
                                ...remote,
                                passes: remote.passes?.length ? remote.passes : (local?.passes ?? []),
                                blendMode: remote.blendMode !== "replace" ? remote.blendMode : (local?.blendMode ?? "replace"),
                                blendOpacity: remote.blendOpacity !== 1 ? remote.blendOpacity : (local?.blendOpacity ?? 1),
                            });
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
            version: 6,
            migrate(state: unknown, version: number) {
                const s = state as { shaders: ShaderEntry[] };
                if (version === 0) {
                    s.shaders = s.shaders.map((sh) => ({ ...sh, published: sh.published ?? false }));
                }
                if (version <= 1) {
                    s.shaders = s.shaders.map((sh) => ({ ...sh, passes: [] as ShaderPass[] }));
                }
                if (version <= 2) {
                    s.shaders = s.shaders.map((sh) => ({
                        ...sh,
                        passes: (sh.passes ?? []).map((p: unknown) =>
                            typeof p === "string"
                                ? { id: p, blendMode: "replace" as BlendMode, opacity: 1 }
                                : p as ShaderPass
                        ),
                    }));
                }
                if (version <= 3) {
                    s.shaders = s.shaders.map((sh) => ({
                        ...sh,
                        blendMode: (sh as ShaderEntry).blendMode ?? "replace",
                        blendOpacity: (sh as ShaderEntry).blendOpacity ?? 1,
                    }));
                }
                if (version <= 4) {
                    (s as ShaderState).deletedIds = [];
                }
                if (version <= 5) {
                    // postProcessing is optional — no migration needed, undefined = inactive
                }
                return s;
            },
        }
    )
);
