import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Banknote, Receipt, UserX, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { isoDate, money } from '../../lib/format'
import { useChartColors } from '../../components/charts'
import { ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui'

export default function Dashboard() {
  const [day, setDay] = useState(isoDate())
  const { data: s, loading, error, reload } = useApi(() => api.get('/admin/orders/stats', { params: { date: day } }).then((r) => r.data), [day])
  const users = useApi(() => api.get('/admin/users/stats').then((r) => r.data), [])
  useInterval(() => day === isoDate() && reload({ silent: true }), 30_000)
  const colors = useChartColors()

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const active = s.byStatus.PLACED + s.byStatus.PREPARING + s.byStatus.READY
  const hours = s.ordersByHour.map((count, h) => ({ hour: `${h}:00`, count })).filter((_, i) => i >= 6 && i <= 23)
  const week = s.last7Days.map((d) => ({ ...d, day: new Date(d.label).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }), revenue: Number(d.revenue) }))
  const restaurants = s.byRestaurant.map((r) => ({ ...r, revenue: Number(r.revenue) }))
  const axis = { tick: { fill: colors.text, fontSize: 11 }, tickLine: false, axisLine: false }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="All restaurants at a glance."
        actions={<input type="date" className="input w-auto" value={day} max={isoDate()} onChange={(e) => setDay(e.target.value || isoDate())} aria-label="Date" />}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard icon={Receipt} label="Orders" value={s.totalOrders} tone="blue" />
        <StatCard icon={Banknote} label="Revenue (collected)" value={money(s.revenue)} tone="green" />
        <StatCard icon={Activity} label="Active right now" value={active} />
        <StatCard icon={UserX} label="No-shows" value={s.byStatus.NO_SHOW} tone="red" />
        <StatCard icon={Users} label="Students" value={users.data?.students ?? '–'} hint={users.data ? `${users.data.blocked} blocked` : ''} tone="blue" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Orders per hour</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={hours} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c2410c" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#c2410c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="hour" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip contentStyle={colors.tooltip} />
              <Area type="monotone" dataKey="count" name="Orders" stroke="#c2410c" strokeWidth={2} fill="url(#fillOrders)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Revenue by restaurant</h2>
          {restaurants.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No orders on this day</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={restaurants} margin={{ left: -5 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} />
                <Tooltip
                  contentStyle={colors.tooltip}
                  cursor={{ fill: colors.cursor }}
                  formatter={(v, _name, item) => [`${money(v)} · ${item.payload.orders} orders`, 'Revenue']}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#c2410c" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Last 7 days</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={week} margin={{ left: -5 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="day" {...axis} />
              <YAxis yAxisId="o" allowDecimals={false} {...axis} />
              <YAxis yAxisId="r" orientation="right" {...axis} />
              <Tooltip contentStyle={colors.tooltip} formatter={(v, name) => (name === 'Revenue' ? money(v) : v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="o" dataKey="orders" name="Orders" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line yAxisId="r" dataKey="revenue" name="Revenue" stroke="#c2410c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Most popular dishes</h2>
          {s.topDishes.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No orders on this day</p>
          ) : (
            <ul className="space-y-3">
              {s.topDishes.map((d) => {
                const max = s.topDishes[0].value
                return (
                  <li key={d.label}>
                    <div className="mb-1 flex justify-between text-sm"><span>{d.label}</span><b>{d.value}</b></div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(d.value / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
