import { ref, watch } from 'vue'
import { defineStore } from 'pinia'


const ZOOM_STORAGE_KEY = 'zoom'


const getStorage = (): Storage | null =>
    typeof window === 'undefined' ? null : window.localStorage



const loadZoom = (storage: Storage | null): { 'result': number, 'editor': number } => {
    const deafult = { 'result': 12, 'editor': 12 }
    if (!storage) return deafult

    const savedZoom = storage.getItem(ZOOM_STORAGE_KEY)
    if (savedZoom === null) {
        storage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(deafult))
        return deafult
    }

    return JSON.parse(savedZoom)
}



export const useUiState = defineStore('ui-state', () => {
    const storage = getStorage()
    const data = loadZoom(storage)
    const editorZoom = ref(data.editor)
    const resultZoom = ref(data.result)


    function zoom(target: 'editor' | 'result', amount: number) {
        if (target === 'editor' && (editorZoom.value > 8 && amount < 0 || editorZoom.value < 32 && amount > 0)) {
            editorZoom.value += amount

        }
        if (target === 'result' && (resultZoom.value > 8 && amount < 0 ||  resultZoom.value < 32 && amount > 0)) {
            resultZoom.value += amount

        }
    }


    watch(editorZoom, () => {
        const saved = { 'result':resultZoom.value, 'editor':  editorZoom.value }
        storage?.setItem(ZOOM_STORAGE_KEY, JSON.stringify(saved))

    })
    watch(resultZoom, () => {
          const saved = { 'result':resultZoom.value, 'editor':  editorZoom.value }
        storage?.setItem(ZOOM_STORAGE_KEY, JSON.stringify(saved))

    })

    return { editorZoom, resultZoom, zoom, }
})
