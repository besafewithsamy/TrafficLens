import { create } from 'zustand'
import type { Capture } from '../types/api'

interface AppState {
  selectedCaptureId: string | null
  setSelectedCapture: (id: string | null) => void
  lastUpload: Capture | null
  setLastUpload: (c: Capture | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedCaptureId: null,
  setSelectedCapture: (id) => set({ selectedCaptureId: id }),
  lastUpload: null,
  setLastUpload: (c) => set({ lastUpload: c }),
}))
