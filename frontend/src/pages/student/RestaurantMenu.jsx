import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Clock, MapPin, Search, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { useCart } from '../../context/CartContext'
import DishCard from '../../components/DishCard'
import { EmptyState, ErrorBox, FoodImage, Modal, PageLoader, Rating, RestaurantStatusBadge } from '../../components/ui'

export default function RestaurantMenu() {
  const { id } = useParams()
  const restaurantId = Number(id)
  const { data, loading, error, reload } = useApi(() => api.get(`/restaurants/${id}`).then((r) => r.data), [id])
  const favs = useApi(() => api.get('/favourites/ids').then((r) => r.data), [])
  useInterval(() => reload({ silent: true }), 45_000)

  const cart = useCart()
  const [pending, setPending] = useState(null) // dish waiting for "replace cart?" confirmation
  const [search, setSearch] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('popular')

  const dishes = useMemo(() => data?.dishes ?? [], [data])
  const categories = useMemo(() => ['All', ...new Set(dishes.map((d) => d.category))], [dishes])
  const shown = useMemo(() => {
    let list = dishes.filter(
      (d) =>
        (!vegOnly || d.veg) &&
        (category === 'All' || d.category === category) &&
        (!search || d.name.toLowerCase().includes(search.toLowerCase())),
    )
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'rating') list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return list
  }, [dishes, vegOnly, category, search, sort])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const { restaurant } = data
  const canOrder = restaurant.status === 'OPEN'
  const favouriteIds = new Set(favs.data ?? [])

  const changeQuantity = (dish, q) => {
    if (cart.conflicts(restaurant.id) && q > 0) return setPending(dish)
    cart.setQuantity(dish, restaurant, q)
  }

  const toggleFavourite = async (dish) => {
    const isFav = favouriteIds.has(dish.id)
    favs.setData(isFav ? [...favouriteIds].filter((x) => x !== dish.id) : [...favouriteIds, dish.id])
    try {
      if (isFav) await api.delete(`/favourites/${dish.id}`)
      else {
        await api.post(`/favourites/${dish.id}`)
        toast.success(`${dish.name} added to favourites`)
      }
    } catch (e) {
      toast.error(errorMessage(e))
      favs.reload({ silent: true })
    }
  }

  const inThisCart = cart.cart.restaurantId === restaurantId

  return (
    <div className="pb-32">
      <Link to="/restaurants" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> All restaurants
      </Link>

      <div className="card mb-6 flex flex-col gap-4 overflow-hidden sm:flex-row">
        <FoodImage src={restaurant.imageUrl} alt={restaurant.name} className="h-40 w-full sm:h-auto sm:w-56" kind="restaurant" />
        <div className="flex-1 p-5 sm:pl-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            <RestaurantStatusBadge status={restaurant.status} />
            <Rating value={restaurant.rating} count={restaurant.ratingCount} />
          </div>
          {restaurant.description && <p className="mt-2 text-muted">{restaurant.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {restaurant.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {restaurant.location}</span>}
            {restaurant.openingHours && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {restaurant.openingHours}</span>}
          </div>
          {!canOrder && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {restaurant.status === 'BUSY'
                ? `The kitchen is very busy. New orders open again at ${time(restaurant.busyUntil)}.`
                : 'This restaurant is closed right now. You can look at the menu, but ordering is off.'}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-3 bg-cream/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search this menu" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search this menu" />
          </div>
          <button
            onClick={() => setVegOnly((v) => !v)}
            className={`btn border ${vegOnly ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            aria-pressed={vegOnly}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Veg only
          </button>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort dishes">
            <option value="popular">Recommended</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`chip shrink-0 px-4 py-2 text-sm ${category === c ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {dishes.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No dishes available today" text="No menu yet today." />
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches your filters" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((d) => (
            <DishCard
              key={d.id}
              dish={d}
              canOrder={canOrder}
              quantity={inThisCart ? cart.quantityOf(d.id) : 0}
              onQuantity={(q) => changeQuantity(d, q)}
              favourite={favouriteIds.has(d.id)}
              onFavourite={() => toggleFavourite(d)}
            />
          ))}
        </div>
      )}

      {cart.count > 0 && inThisCart && (
        <Link
          to="/cart"
          className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-xl animate-pop items-center justify-between rounded-full bg-brand-500 py-2 pl-6 pr-2 text-white shadow-block-sm md:bottom-6"
        >
          <span className="flex items-center gap-3 font-semibold">
            <ShoppingBag className="h-5 w-5" /> {cart.count} item{cart.count > 1 ? 's' : ''} · {money(cart.total)}
          </span>
          <span className="flex min-h-11 items-center gap-1 rounded-full bg-white px-4 font-bold text-brand">
            View cart <ChevronRight className="h-5 w-5" />
          </span>
        </Link>
      )}

      <Modal open={!!pending} onClose={() => setPending(null)} title="Start a new cart?">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your cart has dishes from <b>{cart.cart.restaurantName}</b>. Each order is collected from one counter, so
          adding this dish will clear that cart.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setPending(null)}>Keep old cart</button>
          <button
            className="btn-primary"
            onClick={() => {
              cart.clear()
              cart.setQuantity(pending, restaurant, 1)
              setPending(null)
            }}
          >
            Start new cart
          </button>
        </div>
      </Modal>
    </div>
  )
}
