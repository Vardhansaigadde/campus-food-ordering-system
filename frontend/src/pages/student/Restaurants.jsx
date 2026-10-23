import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, Search, Store, UtensilsCrossed } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { EmptyState, ErrorBox, FoodImage, PageLoader, Rating, RestaurantStatusBadge, VegMark } from '../../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Good morning – breakfast time'
  if (h < 16) return 'Good afternoon – lunch break?'
  if (h < 19) return 'Snack time'
  return 'Good evening – dinner time'
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

  return (
    <>
      {/* Hero block */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-brand-500 p-6 text-white shadow-block-sm sm:p-8 dark:shadow-none">
        <div aria-hidden="true" className="absolute hidden sm:block -right-10 -top-10 h-40 w-40 rotate-12 rounded-[2rem] bg-white/10" />
        <div aria-hidden="true" className="absolute hidden sm:block -bottom-8 right-24 h-20 w-20 rounded-full border-4 border-white/20" />
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/85">{greeting()}</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">What would you like to eat?</h1>
          <p className="mt-2 font-medium text-white/90">Pick a canteen, order, and collect at the counter with your Order ID + OTP.</p>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              className="input h-13 rounded-full border-transparent pl-11 text-base shadow-block"
              placeholder="Search dishes in all canteens – biryani, dosa, coffee…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search dishes in all restaurants"
            />
          </div>
        </div>
      </section>

      {results && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Dishes available today</h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted">No dish matching "{query}" is on today's menus.</p>
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
        <EmptyState icon={Store} title="No restaurants yet" text="The canteen office hasn't added any restaurants." />
      ) : (
        <>
        <h2 className="mb-4 text-2xl font-extrabold">Campus canteens</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r, i) => (
            <Link
              key={r.id}
              to={`/restaurants/${r.id}`}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              className={`blocky group animate-rise overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgb(28_25_23/0.12)] ${r.status === 'CLOSED' ? 'opacity-75 grayscale-[40%]' : ''}`}
            >
              <div className="relative">
                <FoodImage src={r.imageUrl} alt={r.name} className="h-40 w-full border-b border-line dark:border-slate-700" kind="restaurant" />
                <div className="absolute left-3 top-3">
                  <RestaurantStatusBadge status={r.status} />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-bold group-hover:text-brand">{r.name}</h3>
                  <Rating value={r.rating} count={r.ratingCount} />
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {r.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.location}</span>
                  )}
                  {r.openingHours && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {r.openingHours}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3.5 w-3.5" /> {r.dishesToday} dishes today
                  </span>
                </div>
                {r.status === 'BUSY' && r.busyUntil && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    Very busy – taking new orders again at {time(r.busyUntil)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </>
  )
}
