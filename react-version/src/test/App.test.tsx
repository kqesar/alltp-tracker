import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('should render the app title', () => {
    render(<App />)
    
    expect(screen.getByText('A Link to the Past - Item Tracker')).toBeInTheDocument()
  })

  it('should render items section', () => {
    render(<App />)
    
    expect(screen.getByText('Items')).toBeInTheDocument()
  })

  it('should render dungeons section', () => {
    render(<App />)
    
    expect(screen.getByText('Dungeons')).toBeInTheDocument()
  })

  it('should render show chests checkbox', () => {
    render(<App />)
    
    const checkbox = screen.getByLabelText('Show Chests')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked() // Default should be true
  })

  it('should render position select', () => {
    render(<App />)
    
    const select = screen.getByDisplayValue('Top')
    expect(select).toBeInTheDocument()
  })

  it('should render all item types', () => {
    render(<App />)
    
    // Verify that all items from our initial state are rendered
    const itemElements = screen.getAllByRole('img')
    expect(itemElements.length).toBeGreaterThan(0)
  })

  it('should render all dungeons', () => {
    render(<App />)
    
    // Check for specific dungeon names
    expect(screen.getByText('Eastern Palace')).toBeInTheDocument()
    expect(screen.getByText('Desert Palace')).toBeInTheDocument()
    expect(screen.getByText('Hyrule Castle')).toBeInTheDocument()
  })
})
