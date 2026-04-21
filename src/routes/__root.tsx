import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureSignedIn, fetchRemoteShaders, upsertShader } from "../lib/supabase-sync";
import { useShaderStore } from "../lib/shader-store";

function RootLayout() {
    const seedFromRemote = useShaderStore((s) => s.seedFromRemote);

    useEffect(() => {
        async function init() {
            const userId = await ensureSignedIn();
            const remote = await fetchRemoteShaders();
            seedFromRemote(remote);

            // push any local-only shaders up to remote
            const local = useShaderStore.getState().shaders;
            const remoteIds = new Set(remote.map((s) => s.id));
            for (const sh of local) {
                if (!remoteIds.has(sh.id)) {
                    await upsertShader(sh, userId);
                }
            }
        }
        init().catch(console.error);
    }, []);

    return <Outlet />;
}

export const Route = createRootRoute({
    component: RootLayout,
});
