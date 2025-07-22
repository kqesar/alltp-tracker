import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState } from '../hooks/useGameState'

describe('useGameState Hook', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  it('should initialize with default game state', () => {
    const { result } = renderHook(() => useGameState())
    
    expect(result.current.gameState.items.bow.value).toBe(0)
    expect(result.current.gameState.items.sword.value).toBe(0)
    expect(result.current.gameState.settings.showChests).toBe(true)
    expect(result.current.gameState.settings.position).toBe('top')
  })

  it('should update item values correctly', () => {
    const { result } = renderHook(() => useGameState())
    
    act(() => {
      result.current.updateItem('bow', 1)
    })
    
    expect(result.current.gameState.items.bow.value).toBe(1)
  })

  it('should not exceed max value for items', () => {
    const { result } = renderHook(() => useGameState())
    
    act(() => {
      result.current.updateItem('bow', 999) // Bow max is 3
    })
    
    expect(result.current.gameState.items.bow.value).toBe(3)
  })

  it('should not go below 0 for items', () => {
    const { result } = renderHook(() => useGameState())
    
    act(() => {
      result.current.updateItem('bow', -5)
    })
    
    expect(result.current.gameState.items.bow.value).toBe(0)
  })

  it('should toggle dungeon completion', () => {
    const { result } = renderHook(() => useGameState())
    
    expect(result.current.gameState.dungeons[0].completed).toBe(false)
    
    act(() => {
      result.current.toggleDungeon('eastern')
    })
    
    const easternPalace = result.current.gameState.dungeons.find(d => d.id === 'eastern')
    expect(easternPalace?.completed).toBe(true)
  })

  it('should update settings correctly', () => {
    const { result } = renderHook(() => useGameState())
    
    act(() => {
      result.current.updateSettings({ showChests: false, position: 'bottom' })
    })
    
    expect(result.current.gameState.settings.showChests).toBe(false)
    expect(result.current.gameState.settings.position).toBe('bottom')
  })

  it('should calculate dark world accessibility correctly', () => {
    const { result } = renderHook(() => useGameState())
    
    // Initially dark world dungeons should not be accessible
    const darkPalace = result.current.gameState.dungeons.find(d => d.id === 'darkness')
    expect(darkPalace?.accessible).toBe(false)
    
    // Get required items for dark world access
    act(() => {
      result.current.updateItem('moonpearl', 1)
      result.current.updateItem('agahnim', 1)
      result.current.updateItem('hookshot', 1)
    })
    
    // Now dark world dungeons should be accessible
    const updatedDarkPalace = result.current.gameState.dungeons.find(d => d.id === 'darkness')
    expect(updatedDarkPalace?.accessible).toBe(true)
  })

  it('should reset game state correctly', () => {
    const { result } = renderHook(() => useGameState())
    
    // Change some values
    act(() => {
      result.current.updateItem('bow', 2)
      result.current.toggleDungeon('eastern')
      result.current.updateSettings({ showChests: false })
    })
    
    // Reset
    act(() => {
      result.current.resetGame()
    })
    
    // Verify reset
    expect(result.current.gameState.items.bow.value).toBe(0)
    expect(result.current.gameState.dungeons[0].completed).toBe(false)
    expect(result.current.gameState.settings.showChests).toBe(true)
  })
})
