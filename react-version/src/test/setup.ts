import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global functions from the original app
declare global {
  var showChest: any
  var setOrder: any
  var toggleChests: any
  var updateDungeons: any
}

global.showChest = vi.fn()
global.setOrder = vi.fn()
global.toggleChests = vi.fn()
global.updateDungeons = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

// Mock Image class for tests
class MockImage {
  onload: ((this: GlobalEventHandlers, ev: Event) => any) | null = null
  onerror: ((this: GlobalEventHandlers, ev: ErrorEvent) => any) | null = null
  alt = ''
  width = 0
  height = 0
  private _src = ''
  
  set src(value: string) {
    this._src = value
    setTimeout(() => {
      if (this.onload) this.onload.call(this as any, new Event('load'))
    }, 0)
  }
  
  get src() {
    return this._src
  }
}

// @ts-ignore
global.Image = MockImage
