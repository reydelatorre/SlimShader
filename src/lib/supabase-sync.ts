import { supabase } from "./supabase";
import type { ShaderEntry, ShaderUniform, ShaderPass } from "./shader-store";
import { cached, invalidate, prime } from "./query-cache";

interface ShaderRow {
    id: string;
    user_id: string;
    name: string;
    fragment_source: string;
    uniforms: ShaderUniform[];
    passes: ShaderPass[];
    blend_mode: string;
    blend_opacity: number;
    published: boolean;
    created_at: string;
    updated_at: string;
}

interface ProfileRow {
    id: string;
    username: string | null;
}

// ShaderEntry augmented with the author's username — used only in gallery fetches
export interface GalleryEntry extends ShaderEntry {
    username: string | null;
}

// GalleryEntry plus resolved pass dependency shaders for the detail page
export interface ShaderDetail extends GalleryEntry {
    passDeps: ShaderEntry[];
    userId: string;
}

function toRow(entry: ShaderEntry, userId: string): Omit<ShaderRow, "created_at" | "updated_at"> {
    return {
        id: entry.id,
        user_id: userId,
        name: entry.name,
        fragment_source: entry.fragmentSource,
        uniforms: entry.uniforms,
        passes: entry.passes ?? [],
        blend_mode: entry.blendMode ?? "replace",
        blend_opacity: entry.blendOpacity ?? 1,
        published: entry.published,
    };
}

export function rowToEntry(row: ShaderRow): ShaderEntry {
    return {
        id: row.id,
        name: row.name,
        fragmentSource: row.fragment_source,
        uniforms: row.uniforms ?? [],
        passes: (row.passes ?? []).map((p) =>
            typeof p === "string"
                ? { id: p, blendMode: "replace" as const, opacity: 1 }
                : p
        ),
        blendMode: (row.blend_mode as ShaderEntry["blendMode"]) ?? "replace",
        blendOpacity: row.blend_opacity ?? 1,
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
    return cached("remote-owned", async () => {
        const { data, error } = await supabase
            .from("shaders")
            .select("*")
            .order("updated_at", { ascending: false });
        if (error) throw error;
        return (data as ShaderRow[]).map(rowToEntry);
    }, 30_000);
}

export async function upsertShader(entry: ShaderEntry, userId: string): Promise<void> {
    const { error } = await supabase
        .from("shaders")
        .upsert(toRow(entry, userId), { onConflict: "id" });
    if (error) console.error("[sync] upsert failed", error.message);
    else invalidate("remote-owned", "published", `shader:${entry.id}`);
}

export async function deleteRemoteShader(id: string): Promise<void> {
    const { error, count } = await supabase
        .from("shaders")
        .delete({ count: "exact" })
        .eq("id", id);
    if (error) console.error("[sync] delete failed", error.message);
    else {
        if (count === 0) console.warn("[sync] delete matched 0 rows — RLS may be blocking it", id);
        invalidate("remote-owned", "published", `shader:${id}`);
    }
}

export async function fetchShaderById(id: string): Promise<ShaderDetail | null> {
    return cached(`shader:${id}`, async () => {
        const { data: shaderData, error } = await supabase
            .from("shaders")
            .select("*")
            .eq("id", id)
            .single();
        if (error || !shaderData) return null;

        const row = shaderData as ShaderRow;

        const passIds = (row.passes ?? [])
            .map((p: ShaderPass) => (typeof p === "string" ? p : p.id))
            .filter(Boolean);

        let passDeps: ShaderEntry[] = [];
        if (passIds.length > 0) {
            const { data } = await supabase.from("shaders").select("*").in("id", passIds);
            passDeps = ((data as ShaderRow[]) ?? []).map(rowToEntry);
        }

        const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username")
            .eq("id", row.user_id)
            .single();

        const username = (profileData as ProfileRow | null)?.username ?? null;

        return { ...rowToEntry(row), username, passDeps, userId: row.user_id };
    });
}

export async function fetchPublishedShaders(): Promise<GalleryEntry[]> {
    return cached("published", async () => {
        const { data: shaderData, error } = await supabase
            .from("shaders")
            .select("*")
            .eq("published", true)
            .order("updated_at", { ascending: false });
        if (error) throw error;

        const rows = shaderData as ShaderRow[];
        const userIds = [...new Set(rows.map((r) => r.user_id))];

        const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

        const usernameMap = new Map<string, string | null>(
            (profileData as ProfileRow[] ?? []).map((p) => [p.id, p.username])
        );

        return rows.map((row) => ({
            ...rowToEntry(row),
            username: usernameMap.get(row.user_id) ?? null,
        }));
    });
}

export async function fetchProfile(userId: string): Promise<string | null> {
    return cached(`profile:${userId}`, async () => {
        const { data } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", userId)
            .single();
        return (data as ProfileRow | null)?.username ?? null;
    });
}

export async function upsertProfile(userId: string, username: string): Promise<string | null> {
    const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, username }, { onConflict: "id" });
    if (error) return error.message;
    invalidate(`profile:${userId}`, "published");
    prime(`profile:${userId}`, username);
    return null;
}

// Fire-and-forget: sync a single entry using the current session
export function syncEntry(entry: ShaderEntry): void {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        upsertShader(entry, session.user.id);
    });
}
