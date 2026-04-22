import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fetchRemoteShaders, upsertShader } from "../lib/supabase-sync";
import { useShaderStore } from "../lib/shader-store";

const PUBLIC_PATHS = ["/login", "/reset-password"];

function RootLayout() {
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const seedFromRemote = useShaderStore((s) => s.seedFromRemote);

    useEffect(() => {
        // Redirect based on initial session state
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && !PUBLIC_PATHS.includes(pathname)) {
                navigate({ to: "/login" });
            }
            if (session) runSync();
        });

        // React to sign-in / sign-out events
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") {
                navigate({ to: "/login" });
            }
            if (event === "PASSWORD_RECOVERY") {
                navigate({ to: "/reset-password" });
            }
            if (event === "SIGNED_IN" && session) {
                runSync();
                if (PUBLIC_PATHS.includes(pathname)) navigate({ to: "/" });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function runSync() {
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) return;
            const userId = session.user.id;
            const remote = await fetchRemoteShaders();
            seedFromRemote(remote);
            const local = useShaderStore.getState().shaders;
            const remoteIds = new Set(remote.map((s) => s.id));
            for (const sh of local) {
                if (!remoteIds.has(sh.id)) await upsertShader(sh, userId);
            }
        } catch (e) {
            console.error("[sync]", e);
        }
    }

    return <Outlet />;
}

export const Route = createRootRoute({
    component: RootLayout,
});
