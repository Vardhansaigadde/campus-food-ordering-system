import { Flame, Heart, Minus, Plus, Sparkles } from 'lucide-react'
import { FoodImage, Rating, VegMark } from './ui'
import { money } from '../lib/format'
import { MAX_PER_DISH } from '../context/CartContext'

export function Stepper({ value, onChange, max = MAX_PER_DISH, disabled }) {
  if (value === 0) {
    return (
      <button className="btn min-h-10 border border-brand-500 bg-white px-6 py-2 text-brand hover:bg-brand-50 dark:bg-transparent" disabled={disabled} onClick={() => onChange(1)}>
        Add
      </button>
    )
  }
  return (
    <div className="inline-flex items-center rounded-full bg-brand-500 text-white shadow-block-sm dark:shadow-none">
      <button className="flex min-h-10 min-w-10 items-center justify-center rounded-l-full hover:bg-brand-700" onClick={() => onChange(value - 1)} aria-label="Remove one">
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{value}</span>
      <button
        className="flex min-h-10 min-w-10 items-center justify-center rounded-r-full hover:bg-brand-700 disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Add one"
        title={value >= max ? `Max ${max} per dish` : undefined}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function DishCard({ dish, quantity, onQuantity, canOrder, favourite, onFavourite }) {
  return (
    <div className="card flex gap-4 p-4 transition-shadow hover:shadow-md">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <VegMark veg={dish.veg} />
          {dish.special && (
            <span className="chip bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
              <Sparkles className="h-3 w-3" /> Today's Special
            </span>
          )}
          {dish.readyMade && (
            <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Ready now</span>
          )}
          {dish.bestseller && (
            <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Flame className="h-3 w-3" /> Bestseller
            </span>
          )}
        </div>
        <h3 className="mt-1.5 font-semibold">{dish.name}</h3>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="font-semibold">{money(dish.price)}</span>
          <Rating value={dish.rating} count={dish.ratingCount} />
        </div>
        {dish.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{dish.description}</p>}
        {dish.stockLeft != null && dish.stockLeft > 0 && (
          <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">Only {dish.stockLeft} left!</p>
        )}
      </div>
      <div className="flex w-28 shrink-0 flex-col items-center gap-2">
        <div className="relative w-full">
          <FoodImage src={dish.imageUrl} alt={dish.name} className="h-24 w-full rounded-2xl" />
          {onFavourite && (
            <button
              onClick={onFavourite}
              aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 shadow dark:bg-slate-900/90"
            >
              <Heart className={`h-4 w-4 ${favourite ? 'fill-red-500 text-red-500' : 'text-muted'}`} />
            </button>
          )}
        </div>
        {canOrder ? (
          <Stepper value={quantity} onChange={onQuantity} max={Math.min(MAX_PER_DISH, dish.stockLeft ?? MAX_PER_DISH)} />
        ) : (
          <span className="text-xs text-muted">Not taking orders</span>
        )}
      </div>
    </div>
  )
}
