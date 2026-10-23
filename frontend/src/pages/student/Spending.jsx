import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { IndianRupee, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { money } from '../../lib/format'
import { EmptyState, ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui'
import { useChartColors } from '../../components/charts'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Spending() {
  const [month, setMonth] = useState(currentMonth)
  const { data, loading, error, reload } = useApi(() => api.get('/orders/my/summary', { params: { month } }).then((r) => r.data), [month])
  const colors = useChartColors()

  return (
    <>
      <PageHeader
        title="My spending"
        subtitle="Only collected orders are counted."
        actions={<input type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value || currentMonth())} aria-label="Month" />}
      />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Wallet} label="Spent this month" value={money(data.spent)} />
            <StatCard icon={Receipt} label="Orders collected" value={data.orders} tone="blue" />
            <StatCard icon={TrendingUp} label="Average order" value={money(data.averageOrder)} tone="green" />
          </div>
          {data.orders === 0 ? (
            <EmptyState icon={IndianRupee} title="No collected orders this month" />
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="mb-4 font-semibold">Spent per restaurant</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.byRestaurant} margin={{ left: -10 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="label" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => money(v)} contentStyle={colors.tooltip} cursor={{ fill: colors.cursor }} />
                    <Bar dataKey="revenue" name="Spent" fill="#c2410c" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h2 className="mb-4 font-semibold">Your most-ordered dishes</h2>
                <ol className="space-y-3">
                  {data.topDishes.map((d, i) => (
                    <li key={d.label} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand dark:bg-brand-500/10">{i + 1}</span>
                      <span className="flex-1">{d.label}</span>
                      <span className="text-sm text-muted">{d.value} plates</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
