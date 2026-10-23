import { api } from './api'

/**
 * One-tap reorder: loads the restaurant's menu for TODAY and puts back only dishes that are
 * still available (at today's price). Returns how many lines could not be added.
 */
export async function reorder(order, cart) {
  const { data } = await api.get(`/restaurants/${order.restaurantId}`)
  if (data.restaurant.status !== 'OPEN') {
    throw new Error(`${data.restaurant.name} is not taking orders right now`)
  }
  const menu = new Map(data.dishes.map((d) => [d.id, d]))
  cart.clear()
  let missing = 0
  for (const item of order.items) {
    const dish = menu.get(item.dishId)
    if (dish) cart.setQuantity(dish, data.restaurant, item.quantity)
    else missing++
  }
  return { missing, added: order.items.length - missing }
}
