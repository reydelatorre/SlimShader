import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchRemoteShaders, upsertShader, fetchProfile, upsertProfile } from "../lib/supabase-sync";
import { useShaderStore } from "../lib/shader-store";

const PUBLIC_PATHS = ["/login", "/reset-password", "/shader"];

function isPublic(path: string) {
    return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function RootLayout() {
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const pathnameRef = useRef(pathname);
    const seedFromRemote = useShaderStore((s) => s.seedFromRemote);

    const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
    const [usernameValue, setUsernameValue] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [usernameSaving, setUsernameSaving] = useState(false);
    const currentUserIdRef = useRef<string | null>(null);

    // Keep ref current so the auth callback always sees the live path
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && !isPublic(pathnameRef.current)) {
                navigate({ to: "/login" });
            }
            if (session) {
                currentUserIdRef.current = session.user.id;
                runSync();
            }
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") {
                currentUserIdRef.current = null;
                navigate({ to: "/login" });
            }
            if (event === "PASSWORD_RECOVERY") {
                navigate({ to: "/reset-password" });
            }
            if (event === "SIGNED_IN" && session) {
                currentUserIdRef.current = session.user.id;
                runSync();
                if (isPublic(pathnameRef.current)) navigate({ to: "/" });
                // Check for missing username after sign-in
                fetchProfile(session.user.id).then((username) => {
                    if (!username) setShowUsernamePrompt(true);
                });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function runSync() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const userId = session.user.id;
            const remote = await fetchRemoteShaders();
            seedFromRemote(remote);
            const { shaders: local, deletedIds } = useShaderStore.getState();
            const deleted = new Set(deletedIds);
            const remoteIds = new Set(remote.map((s) => s.id));
            for (const sh of local) {
                if (!remoteIds.has(sh.id) && !deleted.has(sh.id)) await upsertShader(sh, userId);
            }
        } catch (e) {
            console.error("[sync]", e);
        }
    }

    async function handleUsernameSave() {
        const trimmed = usernameValue.trim();
        if (!trimmed) { setUsernameError("Username required."); return; }
        if (!/^[a-zA-Z0-9_]{2,24}$/.test(trimmed)) {
            setUsernameError("2–24 chars, letters / numbers / underscores only.");
            return;
        }
        const userId = currentUserIdRef.current;
        if (!userId) return;
        setUsernameSaving(true);
        setUsernameError(null);
        const err = await upsertProfile(userId, trimmed);
        if (err) {
            setUsernameError(err.includes("unique") ? "Username already taken." : err);
        } else {
            setShowUsernamePrompt(false);
        }
        setUsernameSaving(false);
    }

    return (
        <>
            <Outlet />

            {showUsernamePrompt && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-surface-1 border border-border p-6 flex flex-col gap-4 w-80">
                        <div>
                            <p className="text-[10px] text-surface-4 uppercase tracking-widest mb-2">
                                Welcome to SlimShader
                            </p>
                            <p className="text-white text-sm font-medium">Set your username</p>
                        </div>
                        <p className="text-surface-4 text-xs leading-relaxed">
                            Your username appears on published shaders in the community gallery.
                        </p>
                        <div className="flex items-center gap-1">
                            <span className="text-surface-4 text-xs">@</span>
                            <input
                                autoFocus
                                type="text"
                                placeholder="username"
                                value={usernameValue}
                                onChange={(e) => { setUsernameValue(e.target.value); setUsernameError(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") handleUsernameSave(); }}
                                className="flex-1 bg-surface-2 border border-border px-2 py-1.5 text-white text-xs placeholder:text-surface-4 focus:outline-none focus:border-accent-bright"
                            />
                        </div>
                        {usernameError && (
                            <p className="text-red-400 text-[10px]">{usernameError}</p>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowUsernamePrompt(false)}
                                className="px-3 py-1.5 text-xs text-surface-4 border border-border hover:text-white transition-colors"
                            >
                                skip for now
                            </button>
                            <button
                                onClick={handleUsernameSave}
                                disabled={usernameSaving}
                                className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-bright disabled:opacity-50 text-white transition-colors"
                            >
                                {usernameSaving ? "…" : "save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export const Route = createRootRoute({
    component: RootLayout,
});
