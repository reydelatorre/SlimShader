import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface Props {
    value: string;
    onChange: (value: string) => void;
}

const GLSL_KEYWORDS = [
    "void",
    "float",
    "int",
    "uint",
    "bool",
    "vec2",
    "vec3",
    "vec4",
    "mat2",
    "mat3",
    "mat4",
    "sampler2D",
    "uniform",
    "varying",
    "attribute",
    "precision",
    "mediump",
    "highp",
    "lowp",
    "in",
    "out",
    "inout",
    "const",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "break",
    "continue",
    "discard",
    "struct",
];

const GLSL_BUILTINS = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "pow",
    "exp",
    "log",
    "sqrt",
    "abs",
    "sign",
    "floor",
    "ceil",
    "fract",
    "mod",
    "min",
    "max",
    "clamp",
    "mix",
    "step",
    "smoothstep",
    "length",
    "distance",
    "dot",
    "cross",
    "normalize",
    "reflect",
    "refract",
    "texture2D",
    "texture",
    "gl_FragCoord",
    "gl_FragColor",
    "mainImage",
];

function registerGLSL(monaco: typeof import("monaco-editor")) {
    if (monaco.languages.getLanguages().some((l) => l.id === "glsl")) return;

    monaco.languages.register({ id: "glsl" });
    monaco.languages.setMonarchTokensProvider("glsl", {
        keywords: GLSL_KEYWORDS,
        builtins: GLSL_BUILTINS,
        tokenizer: {
            root: [
                [/\/\/.*$/, "comment"],
                [/\/\*/, "comment", "@comment"],
                [/#\w+/, "keyword"],
                [
                    /[a-zA-Z_]\w*/,
                    {
                        cases: {
                            "@keywords": "keyword",
                            "@builtins": "support.function",
                            "@default": "identifier",
                        },
                    },
                ],
                [/\d+\.\d*([eE][+-]?\d+)?/, "number.float"],
                [/\d+/, "number"],
                [/"[^"]*"/, "string"],
                [/[{}()\[\]]/, "delimiter.bracket"],
                [/[;,.]/, "delimiter"],
            ],
            comment: [[/\*\//, "comment", "@pop"], [/./, "comment"]],
        },
    });

    monaco.languages.registerCompletionItemProvider("glsl", {
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const suggestions = [
                ...GLSL_KEYWORDS.map((k) => ({
                    label: k,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: k,
                    range,
                })),
                ...GLSL_BUILTINS.map((b) => ({
                    label: b,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: b,
                    range,
                })),
                {
                    label: "iTime",
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: "iTime",
                    range,
                    detail: "uniform float — elapsed seconds",
                },
                {
                    label: "iResolution",
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: "iResolution",
                    range,
                    detail: "uniform vec2 — canvas size",
                },
                {
                    label: "iMouse",
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: "iMouse",
                    range,
                    detail: "uniform vec4 — mouse xy + click xy",
                },
                {
                    label: "mainImage snippet",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText:
                        "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n\tvec2 uv = fragCoord / iResolution.xy;\n\t$0\n\tfragColor = vec4(uv, 0.0, 1.0);\n}",
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range,
                },
            ];
            return { suggestions };
        },
    });
}

export function ShaderEditor({ value, onChange }: Props) {
    function handleMount(_editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) {
        registerGLSL(monaco);
    }

    return (
        <MonacoEditor
            height="100%"
            language="glsl"
            value={value}
            theme="vs-dark"
            onChange={(v) => onChange(v ?? "")}
            onMount={handleMount}
            options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                fontLigatures: true,
                tabSize: 4,
                insertSpaces: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                glyphMargin: false,
                folding: true,
                wordWrap: "off",
                automaticLayout: true,
                padding: { top: 12 },
                renderLineHighlight: "gutter",
            }}
        />
    );
}
