import FoodSlideshow from '../../components/FoodSlideshow'

/**
 * Login / register: the food photos fill the whole screen and the form floats over them on a
 * frosted-glass card – at the bottom on phones (thumb reach), on the right on wide screens.
 */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <FoodSlideshow>
      {(dish) => (
        <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,calc(env(safe-area-inset-top)+1rem))] sm:px-6 lg:grid lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16 lg:px-10 lg:py-16">
          <div className="flex flex-1 flex-col lg:h-full lg:justify-between lg:py-4">
            <div className="flex items-center gap-2.5 pl-1">
              <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl shadow-lg lg:h-11 lg:w-11" />
              <span className="font-display text-2xl font-extrabold drop-shadow">
                Campus<span className="text-brand-300">Food</span>
              </span>
            </div>

            <div className="mt-auto px-1 pb-5 pt-16 lg:pb-0 lg:pt-0">
              <p aria-hidden="true" className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {dish}
              </p>
              <h2 className="font-display text-[2.6rem] font-extrabold leading-[1.02] drop-shadow-lg lg:text-7xl">
                Hungry?
                <br />
                <span className="text-brand-300">Order ahead.</span>
              </h2>
              <p className="mt-3 max-w-md text-white/90 drop-shadow lg:mt-5 lg:text-lg">
                Skip the queue – collect hot from the counter with your Order ID.
              </p>
            </div>
          </div>

          <main className="animate-rise rounded-[28px] border border-white/50 bg-white/88 p-6 text-ink shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 dark:text-slate-100 sm:p-8">
            <h1 className="text-[1.75rem] font-extrabold leading-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </main>
        </div>
      )}
    </FoodSlideshow>
  )
}
