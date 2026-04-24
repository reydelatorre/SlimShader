import { EFFECT_TEMPLATES, type EffectTemplate } from "../lib/default-shader";
import type { ShaderUniform } from "../lib/shader-store";

interface Props {
    onInsert: (template: EffectTemplate) => void;
    onClose: () => void;
}

export function EffectLibrary({ onInsert, onClose }: Props) {
    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-20"
            onClick={onClose}
        >
            <div
                className="bg-surface-1 border border-border w-full max-w-lg flex flex-col max-h-[70vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                    <p className="text-[10px] text-surface-4 uppercase tracking-widest">Effect Library</p>
                    <button
                        onClick={onClose}
                        className="text-surface-4 hover:text-white text-xs transition-colors"
                    >✕</button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {EFFECT_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { onInsert(t); onClose(); }}
                            className="w-full flex items-start gap-4 px-4 py-3 border-b border-border hover:bg-surface-2 transition-colors text-left group"
                        >
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-white text-sm font-medium group-hover:text-accent-bright transition-colors">
                                    {t.name}
                                </span>
                                <span className="text-surface-4 text-xs">{t.description}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {t.defaultUniforms.map((u) => (
                                        <span
                                            key={u.name}
                                            className="text-[9px] text-surface-4 border border-border px-1 py-0.5"
                                        >
                                            {u.label ?? u.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <span className="text-surface-4 group-hover:text-accent-bright text-xs ml-auto flex-shrink-0 mt-0.5 transition-colors">
                                insert →
                            </span>
                        </button>
                    ))}
                </div>

                <div className="px-4 py-2 border-t border-border flex-shrink-0">
                    <p className="text-[10px] text-surface-4">
                        Effects read from <span className="text-white">iChannel0</span> — add as a pass or use standalone.
    </p>
                </div>
            </div>
        </div>
    );
}

export function buildUniformsFromTemplate(template: EffectTemplate): ShaderUniform[] {
    return template.defaultUniforms.map((u) => ({
        name: u.name,
        type: u.type,
        value: u.value,
        min: u.min ?? 0,
        max: u.max ?? 1,
        step: u.step,
        isColor: u.isColor,
        label: u.label,
        description: u.description,
    }));
}
