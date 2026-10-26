import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Keyboard, QrCode, WifiOff, XCircle } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { playBeep, playChime } from '../../lib/alerts'
import { isNetworkError, loadSnapshot, queueHandover, withSnapshot } from '../../lib/offline'
import QrScanner from '../../components/QrScanner'
import { PageHeader, Spinner, VegMark } from '../../components/ui'

/**
 * The digital replacement for "strike it off in the book":
 * the student says their Order ID + OTP, staff type it here, and only a match marks the order Collected.
 */
export default function VerifyPickup() {
  const location = useLocation()
  const profile = useApi(() => withSnapshot('profile', () => api.get('/restaurant/profile').then((r) => r.data), () => {}), [])
  const code = profile.data?.code ?? ''

  const [mode, setMode] = useState('type')
  const [number, setNumber] = useState('')
  const [otp, setOtp] = useState(['', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { ok, order?, message }
  const [history, setHistory] = useState([])
  const otpRefs = useRef([])
  const numberRef = useRef(null)

  // Coming from the "Verify & hand over" button on the live board
  useEffect(() => {
    const token = location.state?.token
    if (token) {
      setNumber(token.split('-').pop())
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } else {
      numberRef.current?.focus()
    }
  }, [location.state])

  const reset = () => {
    setNumber('')
    setOtp(['', '', '', ''])
    setTimeout(() => numberRef.current?.focus(), 50)
  }

  const finish = (ok, payload) => {
    setResult(ok ? { ok, order: payload } : { ok, message: payload })
    if (ok) {
      playChime()
      setHistory((h) => [{ token: payload.token, at: new Date(), total: payload.total }, ...h].slice(0, 8))
      setNumber('')
      setOtp(['', '', '', ''])
    } else {
      playBeep()
    }
  }

  const verify = async (e) => {
    e?.preventDefault()
    const otpValue = otp.join('')
    if (!number || otpValue.length !== 4) return
    setBusy(true)
    try {
      const token = number.includes('-') ? number : `${code}-${number}`
      try {
        const { data } = await api.post('/restaurant/orders/verify', { token, otp: otpValue })
        finish(true, data)
      } catch (err) {
        if (!isNetworkError(err) || !token.match(/^[A-Za-z]{2,4}-\d+$/)) throw err
        // No internet: save it, show what the saved list says, confirm later (lib/offline.js)
        queueHandover(token.toUpperCase(), otpValue)
        const saved = (loadSnapshot('active-orders')?.data ?? []).find((o) => o.token === token.toUpperCase())
        setResult({ ok: true, offline: true, token: token.toUpperCase(), order: saved ?? null })
        setNumber('')
        setOtp(['', '', '', ''])
        playBeep()
      }
    } catch (err) {
      finish(false, errorMessage(err))
      setOtp(['', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  // Ignore scans while a result is on screen: the same QR still in front of the camera
  // would otherwise come back as "already collected" and turn a valid handover red
  const verifyQr = async (text) => {
    if (busy || result) return
    setBusy(true)
    try {
      const { data } = await api.post('/restaurant/orders/verify-qr', { code: text })
      finish(true, data)
    } catch (err) {
      // No internet: the QR carries the order id + OTP – match it against the saved list
      const [prefix, id, qrOtp] = text.trim().split(':')
      const saved = prefix === 'CFPS' ? (loadSnapshot('active-orders')?.data ?? []).find((o) => String(o.id) === id) : null
      if (isNetworkError(err) && saved) {
        queueHandover(saved.token, qrOtp)
        setResult({ ok: true, offline: true, token: saved.token, order: saved })
        playBeep()
        return
      }
      finish(false, errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    const wasOk = result?.ok
    setResult(null)
    if (mode === 'type') {
      if (wasOk) reset()
      else setTimeout(() => otpRefs.current[0]?.focus(), 50)
    }
  }

  const setDigit = (i, value) => {
    const v = value.replace(/\D/g, '')
    if (v.length > 1) {
      // pasted the whole OTP
      const digits = v.slice(0, 4).split('')
      setOtp([0, 1, 2, 3].map((k) => digits[k] ?? ''))
      otpRefs.current[Math.min(digits.length, 3)]?.focus()
      return
    }
    const next = [...otp]
    next[i] = v
    setOtp(next)
    if (v && i < 3) otpRefs.current[i + 1]?.focus()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Verify pickup" subtitle="Check the Order ID and OTP before handing over." />

      <div className="mb-5 grid grid-cols-2 rounded-full bg-slate-200/70 p-1 sm:inline-grid dark:bg-slate-800">
        <button onClick={() => setMode('type')} className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${mode === 'type' ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}>
          <Keyboard className="h-4 w-4" /> Type code
        </button>
        <button onClick={() => setMode('scan')} className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${mode === 'scan' ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}>
          <QrCode className="h-4 w-4" /> Scan QR
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {mode === 'type' ? (
            <form onSubmit={verify} className="card space-y-6 p-4 sm:p-6">
              <div>
                <label className="label" htmlFor="order-number">Order ID</label>
                <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-slate-300 focus-within:border-brand-500 dark:border-slate-700">
                  <span className="flex items-center bg-slate-100 px-4 text-2xl font-black text-muted dark:bg-slate-800">{code || '…'}-</span>
                  <input
                    id="order-number"
                    ref={numberRef}
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full bg-transparent px-3 py-3 text-3xl font-black tracking-wider outline-none"
                    placeholder="127"
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), otpRefs.current[0]?.focus())}
                  />
                </div>
              </div>
              <div>
                <span className="label">OTP</span>
                <div className="flex gap-2 sm:gap-3">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label={`OTP digit ${i + 1}`}
                      className="h-16 w-0 min-w-0 flex-1 rounded-xl sm:max-w-16 border-2 border-slate-300 bg-white text-center text-3xl font-black outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
                      value={d}
                      maxLength={4}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && otpRefs.current[i - 1]?.focus()}
                    />
                  ))}
                </div>
              </div>
              <button className="btn-primary w-full py-4 text-lg" disabled={busy || !number || otp.join('').length !== 4}>
                {busy && <Spinner className="h-5 w-5" />} Verify
              </button>
            </form>
          ) : (
            <div className="card p-4 sm:p-6">
              <QrScanner onScan={verifyQr} />
              <p className="mt-3 text-center text-sm text-muted">Hold the student's QR code in front of the camera</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold text-muted">Handed over this session</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {history.map((h, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="font-semibold">{h.token}</span>
                    <span className="text-muted">{money(h.total)} · {time(h.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {result && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={result.offline ? 'Saved without internet' : result.ok ? 'Pickup verified' : 'Pickup rejected'}
          className={`fixed inset-0 z-50 flex animate-pop flex-col p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 ${result.offline ? 'bg-amber-400 text-ink' : result.ok ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'}`}
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center overflow-y-auto">
            {result.offline ? <WifiOff className="h-20 w-20" /> : result.ok ? <CheckCircle2 className="h-20 w-20" /> : <XCircle className="h-20 w-20" />}
            {result.offline ? (
              <>
                <p className="mt-4 text-5xl font-black tracking-tight">{result.token}</p>
                <p className="mt-1 text-2xl font-bold">No internet – saved</p>
                {result.order ? (
                  <>
                    <p className="mt-4 rounded-2xl bg-white/50 p-4 text-lg font-bold">
                      Check the name: {result.order.studentName}
                      <span className="block text-base font-semibold">Collect {money(result.order.total)} cash</span>
                    </p>
                    <ul className="mt-4 space-y-1.5 text-lg">
                      {result.order.items.map((i) => (
                        <li key={i.dishId} className="flex items-center gap-2">
                          <span className="rounded bg-white p-0.5"><VegMark veg={i.veg} /></span> <b>{i.quantity}×</b> {i.name}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-4 rounded-2xl bg-white/50 p-4 text-lg font-semibold">
                    Not in the saved list – check the student's pickup pass.
                  </p>
                )}
                <p className="mt-4 text-base font-medium">The OTP is checked automatically when the internet is back. If it was wrong you'll get a warning.</p>
              </>
            ) : result.ok ? (
              <>
                <p className="mt-4 text-5xl font-black tracking-tight">{result.order.token}</p>
                <p className="mt-1 text-2xl font-bold">Hand over the food ✓</p>
                <p className="mt-4 rounded-2xl bg-white/15 p-4 text-xl font-bold">Collect {money(result.order.total)} cash</p>
                <ul className="mt-4 space-y-1.5 text-lg">
                  {result.order.items.map((i) => (
                    <li key={i.dishId} className="flex items-center gap-2">
                      <span className="rounded bg-white p-0.5"><VegMark veg={i.veg} /></span> <b>{i.quantity}×</b> {i.name}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-4 text-4xl font-black tracking-tight">Do not hand over</p>
                <p className="mt-3 text-xl font-medium text-white/95">{result.message}</p>
              </>
            )}
          </div>
          <button
            autoFocus
            onClick={dismiss}
            className="mx-auto mt-6 flex min-h-16 w-full max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-white bg-white text-xl font-black text-ink active:scale-[0.98]"
          >
            {result.ok ? 'Next order' : 'Try again'} <ArrowRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  )
}
