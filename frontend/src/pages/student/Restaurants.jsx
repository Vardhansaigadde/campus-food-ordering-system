import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, Coffee, MapPin, Moon, Search, Store, Sun, Sunset, UtensilsCrossed } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { EmptyState, ErrorBox, FoodImage, PageLoader, Rating, RestaurantStatusBadge, VegMark } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return { text: 'Good morning', icon: Coffee }
  if (h < 16) return { text: 'Good afternoon', icon: Sun }
  if (h < 19) return { text: 'Good evening', icon: Sunset }
  return { text: 'Good evening', icon: Moon }
}

/** Warm covers for canteens without a photo – picked by id so each canteen keeps its colour. */
const COVERS = [
  'from-orange-500 to-amber-400',
  'from-rose-500 to-orange-400',
  'from-amber-500 to-yellow-400',
  'from-red-600 to-orange-500',
  'from-orange-600 to-rose-400',
]

function Cover({ r }) {
  if (r.imageUrl) {
    return <FoodImage src={r.imageUrl} alt={r.name} className="h-full w-full transition-transform duration-500 group-hover:scale-105" kind="restaurant" />
  }
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${COVERS[r.id % COVERS.length]}`}>
      <UtensilsCrossed aria-hidden="true" className="absolute -right-4 -bottom-6 h-32 w-32 rotate-12 text-white/15" />
      <span className="font-display text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">{r.code ?? r.name.slice(0, 2)}</span>
    </div>
  )
}

export default function Restaurants() {
  const { data, loading, error, reload } = useApi(() => api.get('/restaurants').then((r) => r.data), [])
  useInterval(() => reload({ silent: true }), 60_000)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

  // Search dishes across every restaurant's menu for today (debounced)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return setResults(null)
    const id = setTimeout(async () => {
      try {
        const { data } = await api.get('/restaurants/search', { params: { q } })
        setResults(data)
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r]))
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]
  const hello = greeting()

  return (
    <>
      {/* Greeting + search */}
      <section className="mb-7">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <hello.icon className="h-4 w-4" aria-hidden="true" />
          {hello.text}{firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          What would you like to <span className="text-brand">eat?</span>
        </h1>
        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            className="input h-12 rounded-full pl-12"
            placeholder="Search dishes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search dishes in all canteens"
          />
        </div>
      </section>

      {results && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Dishes available today</h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted">No dishes found for "{query}".</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((d) => (
                <Link key={d.id} to={`/restaurants/${d.restaurantId}`} className="card flex items-center gap-3 p-3 transition hover:border-brand-300">
                  <FoodImage src={d.imageUrl} alt={d.name} className="h-14 w-14 shrink-0 rounded-xl text-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold">
                      <VegMark veg={d.veg} /> {d.name}
                    </p>
                    <p className="truncate text-xs text-muted">{byId[d.restaurantId]?.name ?? 'Restaurant'}</p>
                  </div>
                  <span className="font-semibold">{money(d.price)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data.length ? (
        <EmptyState icon={Store} title="No restaurants yet" text="Check back soon." />
      ) : (
        <>
        <h2 className="mb-3 text-lg font-bold">Campus canteens</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r, i) => {
            const closed = r.status === 'CLOSED'
            return (
              <Link
                key={r.id}
                to={`/restaurants/${r.id}`}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                className="card group animate-rise overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgb(28_25_23/0.12)] active:scale-[0.99]"
              >
                <div className={`relative h-36 overflow-hidden ${closed ? 'grayscale-[70%]' : ''}`}>
                  <Cover r={r} />
                  <div className="absolute left-3 top-3 rounded-full bg-white/95 shadow-sm dark:bg-slate-900/90">
                    <RestaurantStatusBadge status={r.status} />
                  </div>
                  {r.dishesToday > 0 && !closed && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                      {r.dishesToday} {r.dishesToday === 1 ? 'dish' : 'dishes'} today
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold leading-snug">{r.name}</h3>
                    <Rating value={r.rating} count={r.ratingCount} />
                  </div>
                  {r.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{r.description}</p>}
                  <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs text-muted dark:border-slate-800">
                    {r.location && (
                      <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.location}</span></span>
                    )}
                    {r.openingHours && (
                      <span className="flex shrink-0 items-center gap-1"><Clock className="h-3.5 w-3.5" /> {r.openingHours}</span>
                    )}
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                  </div>
                  {r.status === 'BUSY' && r.busyUntil && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Very busy – taking new orders again at {time(r.busyUntil)}
                    </p>
                  )}
                  {closed && <p className="mt-3 text-xs font-medium text-muted">Closed now – you can still see the menu.</p>}
                </div>
              </Link>
            )
          })}
        </div>
        </>
      )}
    </>
  )
}
