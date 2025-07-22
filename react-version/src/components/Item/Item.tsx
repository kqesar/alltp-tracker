import React from 'react'
import type { ItemComponentProps } from '../../types/game'
import './Item.css'

const Item: React.FC<ItemComponentProps> = ({ item, onClick }) => {
  const handleClick = () => {
    onClick(item.id)
  }

  const getImagePath = (itemId: string, value: number): string => {
    if (value === 0) return `/images/${itemId}0.png`
    return `/images/${itemId}${value}.png`
  }

  const getItemClass = (): string => {
    const baseClass = 'item'
    const valueClass = item.value === 0 ? 'item--inactive' : 'item--active'
    return `${baseClass} ${valueClass}`
  }

  return (
    <div 
      className={getItemClass()}
      onClick={handleClick}
      title={`${item.name}: ${item.value}/${item.maxValue}`}
    >
      <img 
        src={getImagePath(item.id, item.value)}
        alt={`${item.name} level ${item.value}`}
        className="item__image"
        onError={(e) => {
          // Fallback si l'image n'est pas trouvée
          const target = e.target as HTMLImageElement
          target.src = `/images/placeholder.png`
        }}
      />
      {item.maxValue > 1 && (
        <span className="item__counter">
          {item.value}/{item.maxValue}
        </span>
      )}
    </div>
  )
}

export default Item
