import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as monaco from 'monaco-editor/editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

const LANGUAGE_ID = 'turingScript'
const THEME_ID = 'turing-dark'

const configureMonaco = () => {
  self.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  }

  if (!monaco.languages.getLanguages().some(({ id }) => id === LANGUAGE_ID)) {
    monaco.languages.register({ id: LANGUAGE_ID })
  }

  monaco.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
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
}

export function initMonaco(source: Ref<string>): Ref<HTMLElement | null> {
  const editorHost = ref<HTMLElement | null>(null)
  let editor: monaco.editor.IStandaloneCodeEditor | undefined
  let model: monaco.editor.ITextModel | undefined

  onMounted(() => {
    if (!editorHost.value) return

    configureMonaco()

    model = monaco.editor.createModel(source.value, LANGUAGE_ID)
    editor = monaco.editor.create(editorHost.value, {
      model,
      theme: THEME_ID,
      minimap: { enabled: false },
      automaticLayout: true,
      fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 20,
      padding: { top: 10, bottom: 10 },
      scrollBeyondLastLine: false,
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
    editor?.dispose()
    model?.dispose()
  })

  return editorHost
}
