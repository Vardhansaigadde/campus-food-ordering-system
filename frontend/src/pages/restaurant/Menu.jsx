import MenuManager from '../../components/MenuManager'
import { PageHeader } from '../../components/ui'

const PATHS = {
  list: '/restaurant/menu/dishes',
  create: '/restaurant/menu/dishes',
  photos: '/restaurant/photos',
  item: (id) => `/restaurant/menu/dishes/${id}`,
  availability: (id) => `/restaurant/menu/dishes/${id}/availability`,
  stock: (id) => `/restaurant/menu/dishes/${id}/stock`,
  all: '/restaurant/menu/all-availability',
  copy: '/restaurant/menu/copy-last-day',
}

export default function Menu() {
  return (
    <>
      <PageHeader
        title="Menu"
        subtitle="Add all your dishes once. Every morning, switch on what's available today – students only see those."
      />
      <MenuManager paths={PATHS} />
    </>
  )
}
