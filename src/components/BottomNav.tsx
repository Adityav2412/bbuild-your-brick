'use client'

import { Home, CalendarDays, TrendingUp, Settings, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import type { Screen } from '@/lib/types'

const NAV_ITEMS: {
  id: Screen
  label: string
  icon: React.ElementType
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'plan', label: 'Blueprint', icon: CalendarDays },
  { id: 'progress', label: 'Journey', icon: TrendingUp },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  const { state, dispatch } = useStore()
  const { screen } = state

  if (
    screen === 'welcome' ||
    screen === 'onboarding' ||
    screen === 'welcome-back' ||
    screen === 'update'
  ) {
    return null
  }

  const navigate = (s: Screen) => dispatch({ type: 'NAVIGATE', screen: s })

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 px-3 pb-3"
      aria-label="Main navigation"
    >
      <div className="bg-card/95 backdrop-blur-md border border-border/70 rounded-3xl px-2 pt-2 pb-2 safe-pb shadow-warm">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors',
                screen === id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={label}
              aria-current={screen === id ? 'page' : undefined}
            >
              <Icon
                size={22}
                strokeWidth={screen === id ? 2.2 : 1.7}
              />
              <span
                className={cn(
                  'text-[10px] font-medium',
                  screen === id ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
