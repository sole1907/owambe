'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) return null

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <span className="font-bold text-lg">Owambe</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-black transition">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4 max-w-2xl">
          Plan your perfect Nigerian event
        </h1>
        <p className="text-gray-500 text-lg mb-8 max-w-xl">
          From owambe weddings to corporate dinners — get a personalised event plan, curated vendor
          recommendations, and smart guest management. All in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            Start planning for free
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Sign in
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto grid gap-8 sm:grid-cols-3 text-center">
          {[
            {
              title: 'Smart planning questionnaire',
              desc: 'Answer a few questions and get a personalised checklist, timeline, and budget plan instantly.',
            },
            {
              title: 'Curated vendor directory',
              desc: 'Browse verified venues, caterers, DJs, decorators and more — matched to your budget and city.',
            },
            {
              title: 'Guest list & smart invites',
              desc: 'Send QR-coded invites, manage plus-ones, and check in guests at the door from any device.',
            },
          ].map((f) => (
            <div key={f.title} className="p-6 bg-white rounded-2xl border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} Owambe. Built for Nigerian events.
      </footer>
    </div>
  )
}
