import { useEffect, useState } from 'react'

/** Lunch photos (free Unsplash licence), 900x1050 WebP, ~65 KB each – kept small for mobile data. */
const SLIDES = [
  { src: '/food/biryani.webp', name: 'Dum Biryani' },
  { src: '/food/meals.webp', name: 'South Indian Meals' },
  { src: '/food/fried-rice.webp', name: 'Veg Fried Rice' },
  { src: '/food/paneer.webp', name: 'Paneer Butter Masala' },
  { src: '/food/chicken-biryani.webp', name: 'Chicken Biryani' },
]
const SHOW_MS = 5500

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Full-bleed food photos that slowly zoom (Ken Burns) and cross-fade, with story-style progress bars.
 * Only the current and next photo are loaded, so a phone on mobile data downloads one at a time.
 */
export default function FoodSlideshow({ className = '', children }) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(1) // how many photos have been mounted so far

  useEffect(() => {
    if (reducedMotion()) return undefined
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SHOW_MS)
    return () => clearInterval(id)
  }, [])

  // Mount the next photo while the current one shows, so it is ready for the fade
  useEffect(() => {
    setLoaded((n) => Math.max(n, Math.min(SLIDES.length, index + 2)))
  }, [index])

  const prev = (index - 1 + SLIDES.length) % SLIDES.length
  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {SLIDES.slice(0, loaded).map((s, i) => {
        const active = i === index
        const moving = active || i === prev // keep zooming while it fades out
        return (
          <img
            key={s.src}
            src={s.src}
            alt={active ? s.name : ''}
            aria-hidden={!active}
            fetchPriority={i === 0 ? 'high' : 'low'}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-out ${
              active ? 'opacity-100' : 'opacity-0'
            } ${moving ? (i % 2 ? 'animate-kenburns-b' : 'animate-kenburns-a') : ''}`}
          />
        )
      })}

      {/* Shade so white text stays readable on any photo */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" />

      {/* Story-style progress bars */}
      <div className="absolute inset-x-5 top-[max(1rem,env(safe-area-inset-top))] z-10 flex gap-1.5 lg:inset-x-10 lg:top-8" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <span key={s.src} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              key={i === index ? `on-${index}` : 'off'}
              className={`block h-full rounded-full bg-white ${i < index ? 'w-full' : i === index ? 'animate-story' : 'w-0'}`}
            />
          </span>
        ))}
      </div>

      {/* Name of the dish on screen */}
      <p className="absolute right-5 top-[max(2.25rem,calc(env(safe-area-inset-top)+1.25rem))] z-10 inline-flex items-center gap-2 rounded-full max-[359px]:hidden bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur lg:right-10 lg:top-14">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
        {SLIDES[index].name}
      </p>

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  )
}
