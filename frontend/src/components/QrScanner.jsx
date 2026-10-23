import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * Camera QR scanner for the counter tablet. Calls onScan(text) once per code.
 * Camera access needs https or localhost.
 */
export default function QrScanner({ onScan }) {
  const elementId = `qr-${useId().replace(/:/g, '')}`
  const handler = useRef(onScan)
  useEffect(() => {
    handler.current = onScan
  })
  const [error, setError] = useState('')

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId)
    let last = ''
    let running = false
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (text === last) return
          last = text
          handler.current(text)
          setTimeout(() => (last = ''), 3000)
        },
        () => {},
      )
      .then(() => (running = true))
      .catch(() => setError('Camera not available. Allow camera access, or type the Order ID and OTP instead.'))
    return () => {
      if (running) scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [elementId])

  return (
    <div>
      <div id={elementId} className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black" />
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
