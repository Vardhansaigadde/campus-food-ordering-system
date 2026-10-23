import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

/**
 * Cart: one restaurant at a time (each order is picked up from one counter).
 * Kept in the browser only – prices are always re-checked by the server when ordering.
 */
export const MAX_PER_DISH = 7

const CartContext = createContext(null)

const empty = { restaurantId: null, restaurantName: '', items: {} }

function storageKey(user) {
  return user ? `cf-cart-${user.id}` : null
}

function readCart(key) {
  if (!key) return empty
  try {
    return JSON.parse(localStorage.getItem(key)) ?? empty
  } catch {
    return empty
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const key = storageKey(user)
  // The cart belongs to one user: re-read it from storage whenever the logged-in user changes
  // (adjusting state during render instead of in an effect, so the saved cart is never overwritten).
  const [state, setState] = useState(() => ({ key, cart: readCart(key) }))
  if (state.key !== key) setState({ key, cart: readCart(key) })
  const cart = state.key === key ? state.cart : readCart(key)
  const setCart = useCallback(
    (update) => setState((s) => ({ ...s, cart: typeof update === 'function' ? update(s.cart) : update })),
    [],
  )

  useEffect(() => {
    if (!state.key) return
    try {
      localStorage.setItem(state.key, JSON.stringify(state.cart))
    } catch {
      /* private mode – cart lives in memory only */
    }
  }, [state])

  const setQuantity = useCallback((dish, restaurant, quantity) => {
    setCart((c) => {
      const base = c.restaurantId === restaurant.id ? c : { restaurantId: restaurant.id, restaurantName: restaurant.name, items: {} }
      const items = { ...base.items }
      const q = Math.max(0, Math.min(MAX_PER_DISH, quantity))
      if (q === 0) delete items[dish.id]
      else items[dish.id] = { dish, quantity: q }
      return Object.keys(items).length ? { ...base, items } : empty
    })
  }, [])

  const value = useMemo(() => {
    const lines = Object.values(cart.items)
    return {
      cart,
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      total: lines.reduce((sum, l) => sum + Number(l.dish.price) * l.quantity, 0),
      quantityOf: (dishId) => cart.items[dishId]?.quantity ?? 0,
      /** true when adding from this restaurant would replace a cart from another one */
      conflicts: (restaurantId) => cart.restaurantId !== null && cart.restaurantId !== restaurantId,
      setQuantity,
      clear: () => setCart(empty),
    }
  }, [cart, setQuantity])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
