import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'

/** Lunch photos (free Unsplash licence), 900x1050 WebP, ~70 KB each – kept small for mobile data. */
const SLIDES = [
  { src: '/food/chicken-dum-biryani.webp', name: 'Chicken Dum Biryani' },
  { src: '/food/chicken-fried-rice.webp', name: 'Chicken Fried Rice' },
  { src: '/food/chicken-lollipops.webp', name: 'Chicken Lollipops' },
  { src: '/food/chicken-fry-piece-biryani.webp', name: 'Chicken Fry Piece Biryani' },
]

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const typing = () => document.activeElement?.matches?.('input, textarea, select')

/**
 * Full-screen food photos behind the page: they slowly zoom (Ken Burns) and cross-fade, with
 * story-style progress bars and a pause button. The progress bar's own animation advances the
 * slides, so pausing (button, or while the user types) freezes the bar, the zoom and the timer
 * together. Only the current and next photo are loaded, so a phone on mobile data downloads one
 * at a time. `children` is a function that receives the name of the dish on screen.
 */
export default function FoodSlideshow({ children }) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(1) // how many photos have been mounted so far
  const [stopped, setStopped] = useState(reducedMotion) // pause button (starts paused for reduced motion)
  const [focusPause, setFocusPause] = useState(false)

  // Don't move photos behind the form while someone is typing
  useEffect(() => {
    const update = () => setFocusPause(typing())
    const later = () => setTimeout(update) // focus has moved on only after focusout
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', later)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', later)
    }
  }, [])

  // Mount the next photo while the current one shows, so it is ready for the fade
  useEffect(() => {
    setLoaded((n) => Math.max(n, Math.min(SLIDES.length, index + 2)))
  }, [index])

  const hold = stopped || focusPause ? '[animation-play-state:paused]' : ''
  const next = () => {
    if (!reducedMotion()) setIndex((i) => (i + 1) % SLIDES.length)
  }
  const prev = (index - 1 + SLIDES.length) % SLIDES.length

  return (
    <div className="relative min-h-dvh text-white">
      {/* Photos fill the screen and stay put while the form scrolls */}
      <div role="img" aria-label="Photos of chicken dishes from the campus canteens" className="fixed inset-0 overflow-hidden bg-ink">
        {SLIDES.slice(0, loaded).map((s, i) => {
          const active = i === index
          const moving = active || i === prev // keep zooming while it fades out
          return (
            <img
              key={s.src}
              src={s.src}
              alt=""
              fetchPriority={i === 0 ? 'high' : 'low'}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-out ${
                active ? 'opacity-100' : 'opacity-0'
              } ${moving ? `${i % 2 ? 'animate-kenburns-b' : 'animate-kenburns-a'} ${hold}` : ''}`}
            />
          )
        })}
        {/* Shade: darker at the top (logo) and bottom (text), lighter in the middle so the food shows */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/75" />
        <div aria-hidden="true" className="absolute inset-0 hidden bg-gradient-to-r from-black/55 via-transparent to-black/30 lg:block" />
      </div>

      {/* Story-style progress bars – the active one drives the slideshow */}
      <div className="absolute inset-x-5 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex gap-1.5 lg:inset-x-10 lg:top-6" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <span key={s.src} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              key={i === index ? `on-${index}` : 'off'}
              onAnimationEnd={i === index ? next : undefined}
              className={`block h-full rounded-full bg-white ${
                i < index ? 'w-full' : i === index ? `animate-story ${hold}` : 'w-0'
              }`}
            />
          </span>
        ))}
      </div>

      {/* Pause / play */}
      <button
        type="button"
        onClick={() => setStopped((s) => !s)}
        className="absolute right-3 top-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] z-20 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/30 lg:right-8 lg:top-10"
        aria-label={stopped ? 'Play photo slideshow' : 'Pause photo slideshow'}
        aria-pressed={stopped}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur">
          {stopped ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
        </span>
      </button>

      <div className="relative z-10">{children(SLIDES[index].name)}</div>
    </div>
  )
}
