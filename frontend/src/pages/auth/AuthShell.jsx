import { Clock3, QrCode, ShieldCheck } from 'lucide-react'
import Brand from '../../components/Brand'

const POINTS = [
  { icon: Clock3, title: 'Live queue & ready time', text: 'See your place in the kitchen queue.' },
  { icon: QrCode, title: 'Order ID + OTP or QR', text: 'Collect at the counter in seconds.' },
  { icon: ShieldCheck, title: 'Only you can collect', text: 'Your OTP is shown only to you.' },
]

/** Split screen used by the login and register pages (Vibrant & Block-based style). */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* geometric blocks */}
        <div aria-hidden="true" className="absolute -right-16 top-24 h-56 w-56 rotate-12 rounded-[2.5rem] bg-brand-500" />
        <div aria-hidden="true" className="absolute -bottom-10 right-40 h-32 w-32 -rotate-6 rounded-3xl border-4 border-brand-500" />
        <div aria-hidden="true" className="absolute bottom-40 -left-10 h-24 w-24 rounded-full bg-trust/80" />

        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <span className="font-display text-2xl font-extrabold">
            Campus<span className="text-brand-400">Food</span>
          </span>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 inline-block rounded-full bg-brand-500 px-3 py-1 text-sm font-bold text-white">No phone calls. No notebook.</p>
          <h2 className="font-display text-5xl font-extrabold leading-[1.05]">
            Order ahead.
            <br />
            <span className="text-brand-400">Skip the queue.</span>
          </h2>
          <p className="mt-5 text-lg text-slate-300">
            Pick any campus canteen, place your order, and collect it at the counter with your Order ID and OTP.
          </p>
          <ul className="mt-10 grid gap-3">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4 rounded-2xl border-2 border-white/15 bg-white/5 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-slate-300">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Pickup only – food is collected at the restaurant counter.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-4xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="blocky mt-8 p-6 sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
