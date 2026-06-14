'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'

type User = {
  id: string
  email: string
  full_name: string
  role: string
}

type AuthContextType = {
  user: User | null
  token: string | null
  isLoading: boolean
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ message: string }>
  exchangeToken: (accessToken: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'owambe_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      setToken(stored)
      api
        .get<User>('/auth/me', stored)
        .then(setUser)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const res = await api.post<{ message: string }>('/auth/signup', {
      email,
      password,
      fullName,
      phone,
    })
    return res
  }

  const exchangeToken = async (accessToken: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/exchange-token', {
      access_token: accessToken,
    })
    localStorage.setItem(TOKEN_KEY, res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const signIn = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/signin', { email, password })
    localStorage.setItem(TOKEN_KEY, res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signUp, signIn, signOut, exchangeToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
