/**
 * The admin area lives on a secret path that is never linked from any page.
 * Change it with VITE_ADMIN_PATH in frontend/.env.local (e.g. VITE_ADMIN_PATH=/my-secret-path).
 */
export const ADMIN_BASE = (import.meta.env.VITE_ADMIN_PATH || '/admin-2406').replace(/\/$/, '')
