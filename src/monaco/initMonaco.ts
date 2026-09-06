import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as monaco from 'monaco-editor/editor'
import 'monaco-editor/editor/contrib/suggest/browser/suggestController'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

const LANGUAGE_ID = 'turingScript'
const THEME_ID = 'turing-dark'

const DEFAULT_FONT_SIZE = 13

export interface MonacoEditorController {
    editorHost: Ref<HTMLElement | null>
    zoom: (newValue: number) => void
}

export function initMonaco(source: Ref<string>): MonacoEditorController {
    const editorHost = ref<HTMLElement | null>(null)
    let editor: monaco.editor.IStandaloneCodeEditor | undefined
    let model: monaco.editor.ITextModel | undefined
    let completionProvider: monaco.IDisposable | undefined
    let fontSize = DEFAULT_FONT_SIZE

    const configureMonaco = (): monaco.IDisposable => {
        self.MonacoEnvironment = {
            getWorker: () => new EditorWorker(),
        }

        if (!monaco.languages.getLanguages().some(({ id }) => id === LANGUAGE_ID)) {
            monaco.languages.register({ id: LANGUAGE_ID })
        }

        monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
            defaultToken: 'invalid',
            tokenPostfix: '.turingScript',
            keywords: [
                'let',
                'const',
                'var',
                'if',
                'else',
                'while',
                'for',
                'in',
                'break',
                'continue',
            ],
            constants: ['true', 'false', 'null', 'undefined'],
            builtins: ['input', 'keyboard', 'time_0', 'time_1', 'counter', 'output', 'screen'],
            brackets: [
                { open: '{', close: '}', token: 'delimiter.curly' },
                { open: '[', close: ']', token: 'delimiter.square' },
                { open: '(', close: ')', token: 'delimiter.parenthesis' },
            ],
            tokenizer: {
                root: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\*/, 'comment', '@comment'],
                    [/\/\/.*$/, 'comment'],
                    [/#.*$/, 'comment'],
                    [
                        /(Math)(\.)(min|max|smin|smax|abs)(?=\s*\()/,
                        ['namespace', 'delimiter', 'function'],
                    ],
                    [
                        /(Math)(\.)(U16_MAX|S16_MAX|U32_MAX|S32_MIN|S32_MAX)\b/,
                        ['namespace', 'delimiter', 'constant.numeric'],
                    ],
                    [/([A-Za-z_$][\w$]*)(\.)(length)\b/, ['identifier', 'delimiter', 'property']],
                    [/0[xX][0-9a-fA-F]+\b/, 'number.hex'],
                    [/0[bB][01]+\b/, 'number.binary'],
                    [/\d+\b/, 'number'],
                    [
                        /[A-Za-z_$][\w$]*/,
                        {
                            cases: {
                                '@keywords': 'keyword',
                                '@constants': 'constant.language',
                                '@builtins': 'function',
                                Array: 'type.identifier',
                                Math: 'namespace',
                                '@default': 'identifier',
                            },
                        },
                    ],
                    [/[{}()\[\]]/, '@brackets'],
                    [
                        /s>>|s<=|s>=|s<|s>|===|!==|==|!=|<<|>>|<=|>=|\+\+|--|\+=|-=|\*=|\/=|%=|&&|\|\||\*\*|[=+\-*\/%&|^!~<>]/,
                        'operator',
                    ],
                    [/[;,.]/, 'delimiter'],
                    [/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/, 'invalid'],
                ],
                comment: [
                    [/[^/*]+/, 'comment'],
                    [/\*\//, 'comment', '@pop'],
                    [/[/*]/, 'comment'],
                ],
            },
        })

        monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
            comments: {
                lineComment: '//',
                blockComment: ['/*', '*/'],
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
            ],
            wordPattern: /[A-Za-z_$][\w$]*/,
            indentationRules: {
                increaseIndentPattern: /^.*\{\s*(?:\/\/.*|#.*)?$/,
                decreaseIndentPattern: /^\s*\}/,
            },
        })

        monaco.editor.defineTheme(THEME_ID, {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: 'A0A1A7' },
                { token: 'keyword', foreground: 'C74DED', fontStyle: 'bold' },
                { token: 'constant.language', foreground: 'DB45A2' },
                { token: 'constant.numeric', foreground: 'F39C12' },
                { token: 'namespace', foreground: '5BC0EB' },
                { token: 'type.identifier', foreground: '00E8C6' },
                { token: 'function', foreground: 'FFE66D' },
                { token: 'property', foreground: '59B8B3' },
                { token: 'operator', foreground: 'EE5D43' },
                { token: 'number', foreground: 'F39C12' },
                { token: 'number.hex', foreground: 'F39C12' },
                { token: 'number.binary', foreground: 'F39C12' },
                { token: 'identifier', foreground: 'D5CED9' },
                { token: 'delimiter', foreground: 'B4ACB8' },
                { token: 'invalid', foreground: 'FC644D', fontStyle: 'underline' },
            ],
            colors: {
                'editor.background': '#23262e',
                'editor.foreground': '#d5ced9',
                'editorLineNumber.foreground': '#746f77',
                'editorLineNumber.activeForeground': '#d5ced9',
                'editorCursor.foreground': '#ffffff',
                'editor.selectionBackground': '#3d4352',
                'editor.selectionHighlightBackground': '#4f4355',
                'editor.wordHighlightBackground': '#4f4355',
                'editor.wordHighlightStrongBackground': '#db45a2',
                'editor.findMatchBackground': '#f39d12',
                'editor.findMatchHighlightBackground': '#59b8b3',
                'editor.findMatchBorder': '#f39d12',
                'editor.hoverHighlightBackground': '#373941',
                'editor.lineHighlightBackground': '#2e323d',
                'editor.lineHighlightBorder': '#2e323d',
                'editorLink.activeForeground': '#3b79c7',
                'editor.rangeHighlightBackground': '#372f3c',
                'editorWhitespace.foreground': '#333844',
                'editorIndentGuide.background1': '#333844',
                'editorIndentGuide.activeBackground1': '#585c66',
                'editorRuler.foreground': '#4f4355',
                'editorCodeLens.foreground': '#746f77',
                'editorBracketMatch.background': '#746f77',
                'editorBracketMatch.border': '#746f77',
                'editorOverviewRuler.border': '#1b1d23',
                'editorError.foreground': '#fc644d',
                'editorWarning.foreground': '#ff9f2e',
                'editorGutter.background': '#23262e',
                'editorGutter.modifiedBackground': '#5bc0eb',
                'editorGutter.addedBackground': '#9bc53d',
                'editorGutter.deletedBackground': '#fc644d',
            },
        })

        type CompletionTemplate = Omit<monaco.languages.CompletionItem, 'range'>
        const snippetRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        const snippets: CompletionTemplate[] = [
            {
                label: { label: 'let', description: 'declaration' },
                filterText: 'let',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Mutable TuringScript variable',
                insertText: 'let ${1:name} = ${2:0}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'const', description: 'declaration' },
                filterText: 'const',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Precompiler-checked constant',
                insertText: 'const ${1:name} = ${2:0}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'var', description: 'declaration' },
                filterText: 'var',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Declaration lowered to let without hoisting',
                insertText: 'var ${1:name} = ${2:0}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'if', description: 'block' },
                filterText: 'if',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'if (${1:condition}) {\n\t$0\n}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'if', description: 'if / else block' },
                filterText: 'if',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'if (${1:condition}) {\n\t${2}\n} else {\n\t$0\n}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'while', description: 'loop' },
                filterText: 'while',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'while (${1:condition}) {\n\t$0\n}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'for', description: 'C-style loop' },
                filterText: 'for',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'for (let ${1:index} = 0; ${1:index} < ${2:limit}; ${1:index}++) {\n\t$0\n}',
                insertTextRules: snippetRule,
            },
            {
                label: { label: 'for', description: 'array index loop' },
                filterText: 'for',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'for (let ${1:index} in ${2:array}) {\n\t$0\n}',
                insertTextRules: snippetRule,
            },
        ]

        const keywordCompletions: CompletionTemplate[] = [
            ['else', 'Conditional fallback'],
            ['in', 'Array-index loop keyword'],
            ['break', 'Exit the nearest loop'],
            ['continue', 'Continue the nearest loop'],
        ].map(([label, detail]) => ({
            label: label ?? '',
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail,
            insertText: label ?? '',
        }))

        const valueCompletions: CompletionTemplate[] = [
            ...['true', 'false', 'null', 'undefined'].map((label) => ({
                label,
                kind: monaco.languages.CompletionItemKind.Value,
                detail: 'TuringScript source value',
                insertText: label,
            })),
            {
                label: 'Array',
                kind: monaco.languages.CompletionItemKind.Function,
                detail: 'Array(size): compile-time-sized static array',
                insertText: 'Array(${1:size})',
                insertTextRules: snippetRule,
            },
        ]

        const hardwareCompletions: CompletionTemplate[] = [
            ['input', 'input()', 'Read general input'],
            ['keyboard', 'keyboard()', 'Read keyboard input'],
            ['time_0', 'time_0()', 'Read low timer word'],
            ['time_1', 'time_1()', 'Read high timer word'],
            ['counter', 'counter()', 'Read instruction counter'],
            ['output', 'output(${1:value})', 'Write a general output value'],
            ['screen', 'screen(${1:setting}, ${2:value})', 'Write a screen setting and value'],
        ].map(([label, insertText, detail]) => ({
            label: label ?? '',
            kind: monaco.languages.CompletionItemKind.Function,
            detail,
            insertText: insertText ?? '',
            insertTextRules: snippetRule,
        }))

        const mathCompletions: CompletionTemplate[] = [
            ['Math.min', 'Math.min(${1:left}, ${2:right})', 'Unsigned minimum'],
            ['Math.max', 'Math.max(${1:left}, ${2:right})', 'Unsigned maximum'],
            ['Math.smin', 'Math.smin(${1:left}, ${2:right})', 'Signed minimum'],
            ['Math.smax', 'Math.smax(${1:left}, ${2:right})', 'Signed maximum'],
            ['Math.abs', 'Math.abs(${1:value})', 'Signed absolute value'],
        ].map(([label, insertText, detail]) => ({
            label: label ?? '',
            kind: monaco.languages.CompletionItemKind.Function,
            detail,
            insertText: insertText ?? '',
            insertTextRules: snippetRule,
        }))

        const mathConstants: CompletionTemplate[] = [
            ['Math.U16_MAX', '0xffff'],
            ['Math.S16_MAX', '0x7fff'],
            ['Math.U32_MAX', '0xffffffff'],
            ['Math.S32_MIN', '0x80000000'],
            ['Math.S32_MAX', '0x7fffffff'],
        ].map(([label, detail]) => ({
            label: label ?? '',
            kind: monaco.languages.CompletionItemKind.Constant,
            detail: `Precompiler constant: ${detail}`,
            insertText: label ?? '',
        }))

        return monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
            triggerCharacters: ['.'],
            provideCompletionItems(currentModel, position) {
                const word = currentModel.getWordUntilPosition(position)
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                }
                const linePrefix = currentModel
                    .getLineContent(position.lineNumber)
                    .slice(0, position.column - 1)

                let templates: CompletionTemplate[]
                if (/\bMath\.[A-Za-z_]*$/.test(linePrefix)) {
                    templates = [...mathCompletions, ...mathConstants].map((item) => ({
                        ...item,
                        label: String(item.label).replace('Math.', ''),
                        insertText: item.insertText.replace('Math.', ''),
                    }))
                } else if (/\b[A-Za-z_$][\w$]*\.[A-Za-z_]*$/.test(linePrefix)) {
                    templates = [
                        {
                            label: 'length',
                            kind: monaco.languages.CompletionItemKind.Property,
                            detail: 'Compile-time array length',
                            insertText: 'length',
                        },
                    ]
                } else {
                    const declaredNames = new Set<string>()
                    const documentText = currentModel.getValue()
                    const declarationPatterns = [
                        /^\s*(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=/gm,
                        /\bfor\s*\(\s*let\s+([A-Za-z_$][\w$]*)\s*(?:=|\bin\b)/g,
                    ]
                    for (const pattern of declarationPatterns) {
                        for (const match of documentText.matchAll(pattern)) {
                            if (match[1]) declaredNames.add(match[1])
                        }
                    }
                    const declaredCompletions: CompletionTemplate[] = [...declaredNames].map((label) => ({
                        label,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        detail: 'Declared program-wide value',
                        insertText: label,
                    }))
                    templates = [
                        ...snippets,
                        ...keywordCompletions,
                        ...valueCompletions,
                        ...hardwareCompletions,
                        ...mathCompletions,
                        ...mathConstants,
                        ...declaredCompletions,
                    ]
                }

                return {
                    suggestions: templates.map((item) => ({ ...item, range })),
                }
            },
        })
    }
    const zoom = (newValue: number): void => {
        if (!Number.isFinite(newValue)) return
        fontSize =  newValue
        editor?.updateOptions({
            fontSize,
            lineHeight: Math.round(fontSize * 1.5),
        })
    }

    onMounted(() => {
        if (!editorHost.value) return

        completionProvider = configureMonaco()

        model = monaco.editor.createModel(source.value, LANGUAGE_ID)
        editor = monaco.editor.create(editorHost.value, {
            model,
            theme: THEME_ID,
            minimap: { enabled: false },
            automaticLayout: true,
            fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize,
            lineHeight: Math.round(fontSize * 1.5),
            padding: { top: 10, bottom: 10 },
            scrollBeyondLastLine: false,
            quickSuggestions: { other: true, comments: false, strings: false },
            quickSuggestionsDelay: 0,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            wordBasedSuggestions: 'off',
            snippetSuggestions: 'top',
            suggest: {
                showKeywords: true,
                showSnippets: true,
                showVariables: true,
                showFunctions: true,
                showConstants: true,
                showProperties: true,
            },
            tabCompletion: 'on',
            bracketPairColorization: { enabled: true },
        })

        editor.onDidChangeModelContent(() => {
            const editorValue = editor?.getValue()
            if (editorValue !== undefined && source.value !== editorValue) source.value = editorValue
        })
    })

    watch(source, (value) => {
        if (model && model.getValue() !== value) model.setValue(value)
    })

    onBeforeUnmount(() => {
        completionProvider?.dispose()
        editor?.dispose()
        model?.dispose()
    })

    return { editorHost, zoom }
}
