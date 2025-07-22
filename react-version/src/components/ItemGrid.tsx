import { defaultItemGrid } from '../hooks/useGameState'
import type { GameState } from '../types/game'

interface ItemGridProps {
  gameState: GameState
  onUpdateItem: (itemId: string, value: number) => void
}

export function ItemGrid({ gameState, onUpdateItem }: ItemGridProps) {
  const handleItemClick = (itemId: string) => {
    if (!itemId) return
    
    const item = gameState.items[itemId]
    if (!item) return
    
    const nextValue = (item.value + 1) % (item.maxValue + 1)
    onUpdateItem(itemId, nextValue)
  }

  return (
    <div className="itemdiv">
      <table className="itemgrid">
        <tbody>
          {defaultItemGrid.map((row: string[], rowIndex: number) => (
            <tr key={rowIndex}>
              {row.map((itemId: string, colIndex: number) => {
                const item = itemId ? gameState.items[itemId] : null
                const isEmpty = !itemId || itemId === ''
                
                return (
                  <td key={colIndex} className="itemcell">
                    {isEmpty ? (
                      <div className="item empty" />
                    ) : (
                      <div 
                        className={`item ${itemId} value-${item?.value || 0}`}
                        onClick={() => handleItemClick(itemId)}
                        title={`${item?.name}: ${item?.value}/${item?.maxValue}`}
                      >
                        <img 
                          src={`/img/${itemId}.png`}
                          alt={item?.name || itemId}
                          className="item-image"
                        />
                        {item && item.value > 0 && (
                          <div className="item-overlay">{item.value}</div>
                        )}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
