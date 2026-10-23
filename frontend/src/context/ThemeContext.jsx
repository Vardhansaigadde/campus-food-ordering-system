import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('cf-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])

  return <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
