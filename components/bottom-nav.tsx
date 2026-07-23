'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="flex border-t border-zinc-800 bg-zinc-950" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <Link
        href="/programmes"
        className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
          pathname.startsWith('/programmes') || pathname.startsWith('/blocks')
            ? 'text-white'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
        </svg>
        Programmes
      </Link>
      <Link
        href="/progress"
        className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
          pathname.startsWith('/progress')
            ? 'text-white'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z" />
        </svg>
        Progress
      </Link>
    </nav>
  )
}
