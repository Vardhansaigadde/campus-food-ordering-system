import FoodSlideshow from '../../components/FoodSlideshow'

function BrandOnPhoto() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl lg:h-11 lg:w-11" />
      <span className="font-display text-xl font-extrabold text-white lg:text-2xl">
        Campus<span className="text-brand-300">Food</span>
      </span>
    </div>
  )
}

/**
 * Login / register layout: moving food photos with the form beside them (wide screens),
 * or photos on top with the form sliding up over them like an app sheet (phones).
 */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <FoodSlideshow className="h-[38dvh] min-h-60 max-h-96 lg:sticky lg:top-0 lg:h-dvh lg:max-h-none">
        <div className="px-5 pt-[max(2.25rem,calc(env(safe-area-inset-top)+1.25rem))] lg:px-10 lg:pt-14">
          <BrandOnPhoto />
        </div>
        <div className="mt-auto hidden px-10 pb-12 text-white lg:block">
          <h2 className="font-display text-5xl font-extrabold leading-[1.05] drop-shadow">
            Order ahead.
            <br />
            <span className="text-brand-300">Skip the queue.</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/85">Hot lunch from your campus canteen, ready when you reach the counter.</p>
        </div>
      </FoodSlideshow>

      <main className="relative z-10 -mt-7 rounded-t-[28px] bg-cream px-5 pb-10 pt-7 dark:bg-slate-950 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-md animate-rise">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          <div className="mt-6 lg:blocky lg:mt-8 lg:p-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
