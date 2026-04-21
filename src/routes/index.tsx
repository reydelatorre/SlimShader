import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useShaderStore } from "../lib/shader-store";

export const Route = createFileRoute("/")({
    component: HomePage,
});

function HomePage() {
    const navigate = useNavigate();
    const { shaders, createShader, deleteShader } = useShaderStore();

    function handleNew() {
        const id = createShader();
        navigate({ to: "/editor/$shaderId", params: { shaderId: id } });
    }

    function handleOpen(id: string) {
        navigate({ to: "/editor/$shaderId", params: { shaderId: id } });
    }

    return (
        <div className="min-h-screen bg-surface-0 flex flex-col">
            <header className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-accent-bright font-bold text-base tracking-wider">
                        SLIM<span className="text-white">SHADER</span>
                    </span>
                    <span className="text-surface-4 text-xs">/ GLSL editor + Love2D exporter</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center gap-10 px-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
                        Slim<span className="text-accent-bright">Shader</span>
                    </h1>
                    <p className="text-surface-4 text-sm">
                        Write GLSL fragment shaders. Preview in real time. Export for Love2D.
                    </p>
                </div>

                <button
                    onClick={handleNew}
                    className="px-6 py-3 bg-accent hover:bg-accent-bright text-white rounded text-sm font-medium transition-colors"
                >
                    + New Shader
                </button>

                {shaders.length > 0 && (
                    <div className="w-full max-w-2xl">
                        <p className="text-xs text-surface-4 mb-3 uppercase tracking-widest">Recent</p>
                        <div className="flex flex-col gap-2">
                            {shaders.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between bg-surface-2 border border-border rounded px-4 py-3 group"
                                >
                                    <button
                                        onClick={() => handleOpen(s.id)}
                                        className="flex-1 text-left text-white hover:text-accent-bright transition-colors text-sm"
                                    >
                                        {s.name}
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <span className="text-surface-4 text-xs">
                                            {new Date(s.updatedAt).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={() => deleteShader(s.id)}
                                            className="opacity-0 group-hover:opacity-100 text-surface-4 hover:text-red-400 transition-all text-xs"
                                        >
                                            delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
