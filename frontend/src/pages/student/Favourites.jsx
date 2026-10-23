import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { money } from '../../lib/format'
import { EmptyState, ErrorBox, FoodImage, PageHeader, PageLoader, VegMark } from '../../components/ui'

export default function Favourites() {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/favourites').then((r) => r.data), [])

  const remove = async (dishId) => {
    setData(data.filter((f) => f.dish.id !== dishId))
    try {
      await api.delete(`/favourites/${dishId}`)
    } catch (e) {
      toast.error(errorMessage(e))
      reload({ silent: true })
    }
  }

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <>
      <PageHeader title="Favourites" subtitle="Tap the heart on any dish to save it here." />
      {!data.length ? (
        <EmptyState icon={Heart} title="No favourites yet" action={<Link to="/restaurants" className="btn-primary">Find something tasty</Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map(({ dish, restaurantName, restaurantActive }) => (
            <div key={dish.id} className="card flex items-center gap-3 p-3">
              <FoodImage src={dish.imageUrl} alt={dish.name} className="h-16 w-16 shrink-0 rounded-xl text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold"><VegMark veg={dish.veg} /> {dish.name}</p>
                <p className="truncate text-xs text-muted">{restaurantName} · {money(dish.price)}</p>
                {dish.availableToday && restaurantActive ? (
                  <Link to={`/restaurants/${dish.restaurantId}`} className="text-xs font-semibold text-emerald-600 hover:underline">
                    Available today – order now →
                  </Link>
                ) : (
                  <span className="text-xs text-muted">Not available today</span>
                )}
              </div>
              <button onClick={() => remove(dish.id)} className="rounded-full p-2 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label={`Remove ${dish.name} from favourites`}>
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
