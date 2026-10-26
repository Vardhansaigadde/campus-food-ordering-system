import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { dateTime } from '../../lib/format'
import { ErrorBox, PageHeader, PageLoader } from '../../components/ui'

export default function Audit() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q)
      setPage(0)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/audit', { params: { q: query || undefined, page, size: 30 } }).then((r) => r.data),
    [query, page],
  )

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when." />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Search action, person or details" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
      </div>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {data.content.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Nothing logged yet</li>}
            {data.content.map((a) => (
              <li key={a.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="chip bg-slate-100 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">{a.action}</span>
                  <span className="text-xs text-muted">{dateTime(a.createdAt)}</span>
                </div>
                <p className="mt-1.5">{a.details}</p>
                <p className="mt-0.5 text-xs text-muted">by {a.actorName} · {a.actorRole}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted dark:bg-slate-800/50">
                <tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.content.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Nothing logged yet</td></tr>}
                {data.content.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{dateTime(a.createdAt)}</td>
                    <td className="px-4 py-2.5">{a.actorName} <span className="text-xs text-muted">{a.actorRole}</span></td>
                    <td className="px-4 py-2.5"><span className="chip bg-slate-100 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">{a.action}</span></td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="flex justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
              <button className="btn-secondary py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-secondary py-1.5" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
