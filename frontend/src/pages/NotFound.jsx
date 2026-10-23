import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-8">
        Go home
      </Link>
    </div>
  )
}
