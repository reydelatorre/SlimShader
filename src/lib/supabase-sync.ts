import { supabase } from "./supabase";
import type { ShaderEntry, ShaderUniform } from "./shader-store";

interface ShaderRow {
    id: string;
    user_id: string;
    name: string;
    fragment_source: string;
    uniforms: ShaderUniform[];
    published: boolean;
    created_at: string;
    updated_at: string;
}

function toRow(entry: ShaderEntry, userId: string): Omit<ShaderRow, "created_at" | "updated_at"> {
    return {
        id: entry.id,
        user_id: userId,
        name: entry.name,
        fragment_source: entry.fragmentSource,
        uniforms: entry.uniforms,
        published: entry.published,
    };
}

export function rowToEntry(row: ShaderRow): ShaderEntry {
    return {
        id: row.id,
        name: row.name,
        fragmentSource: row.fragment_source,
        uniforms: row.uniforms,
        published: row.published,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
    };
}

export async function ensureSignedIn(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated.");
    return session.user.id;
}

export async function fetchRemoteShaders(): Promise<ShaderEntry[]> {
    const { data, error } = await supabase
        .from("shaders")
        .select("*")
        .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as ShaderRow[]).map(rowToEntry);
}

export async function upsertShader(entry: ShaderEntry, userId: string): Promise<void> {
    const { error } = await supabase
        .from("shaders")
        .upsert(toRow(entry, userId), { onConflict: "id" });
    if (error) console.error("[sync] upsert failed", error.message);
}

export async function deleteRemoteShader(id: string): Promise<void> {
    const { error } = await supabase.from("shaders").delete().eq("id", id);
    if (error) console.error("[sync] delete failed", error.message);
}

export async function fetchPublishedShaders(): Promise<ShaderEntry[]> {
    const { data, error } = await supabase
        .from("shaders")
        .select("*")
        .eq("published", true)
        .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as ShaderRow[]).map(rowToEntry);
}

// Fire-and-forget: sync a single entry using the current session
export function syncEntry(entry: ShaderEntry): void {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        upsertShader(entry, session.user.id);
    });
}
