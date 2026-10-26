import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import MenuManager from '../../components/MenuManager'
import { PageHeader } from '../../components/ui'
import { ADMIN_BASE } from '../../config'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'

/** Admin manages any restaurant's dishes on its behalf. */
export default function RestaurantDishes() {
  const { id } = useParams()
  const list = useApi(() => api.get('/admin/restaurants').then((r) => r.data), [])
  const restaurant = list.data?.find((r) => String(r.id) === id)
  const paths = useMemo(
    () => ({
      list: `/admin/restaurants/${id}/dishes`,
      create: `/admin/restaurants/${id}/dishes`,
      photos: '/admin/restaurants/photos',
      item: (d) => `/admin/restaurants/${id}/dishes/${d}`,
      availability: (d) => `/admin/restaurants/${id}/dishes/${d}/availability`,
      all: `/admin/restaurants/${id}/all-availability`,
    }),
    [id],
  )

  return (
    <>
      <Link to={`${ADMIN_BASE}/restaurants`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Restaurants
      </Link>
      <PageHeader title={restaurant ? `${restaurant.name} – dishes` : 'Dishes'} subtitle="Changes are live instantly." />
      <MenuManager paths={paths} />
    </>
  )
}
