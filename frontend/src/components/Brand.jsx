import { Link } from 'react-router-dom'

export default function Brand({ to = '/', subtitle }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-2xl shadow-block-sm" />
      <span className="leading-tight">
        <span className="block font-display text-lg font-extrabold tracking-tight">
          Campus<span className="text-brand">Food</span>
        </span>
        {subtitle && <span className="block text-xs font-medium text-muted">{subtitle}</span>}
      </span>
    </Link>
  )
}
