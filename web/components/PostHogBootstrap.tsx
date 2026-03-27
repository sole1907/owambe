'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/auth'
import { initPostHog, identify, reset } from '@/lib/posthog'

export default function PostHogBootstrap() {
  const { user } = useAuth()

  // Initialise once on mount
  useEffect(() => {
    initPostHog()
  }, [])

  // Identify / reset as auth state changes
  useEffect(() => {
    if (user) {
      identify(user.id, { email: user.email, name: user.full_name, role: user.role })
    } else {
      reset()
    }
  }, [user])

  return null
}
