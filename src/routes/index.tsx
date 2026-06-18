import { createFileRoute } from '@tanstack/react-router'
import { StoreProvider, useStore } from '@/lib/store'
import BottomNav from '@/components/BottomNav'
import WelcomeScreen from '@/components/screens/WelcomeScreen'
import OnboardingScreen from '@/components/screens/OnboardingScreen'
import HomeScreen from '@/components/screens/HomeScreen'
import PlanScreen from '@/components/screens/PlanScreen'
import ProgressScreen from '@/components/screens/ProgressScreen'
import SettingsScreen from '@/components/screens/SettingsScreen'
import WelcomeBackScreen from '@/components/screens/WelcomeBackScreen'
import RecoveryScreen from '@/components/screens/RecoveryScreen'
import UpdateScreen from '@/components/screens/UpdateScreen'
import HistoryScreen from '@/components/screens/HistoryScreen'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Brick — One Brick At A Time' },
      {
        name: 'description',
        content:
          'Brick is your personal study mentor. It decides what to study and how long, so you only have to show up.',
      },
      { property: 'og:title', content: 'Brick — One Brick At A Time' },
      {
        property: 'og:description',
        content:
          'A calm, recovery-first study mentor. No streaks. No pressure. Just one brick at a time.',
      },
    ],
  }),
  component: Page,
})

function AppRouter() {
  const { state } = useStore()
  const { screen } = state

  return (
    <div className="relative min-h-screen max-w-[430px] mx-auto overflow-x-hidden">
      {screen === 'welcome' && <WelcomeScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'plan' && <PlanScreen />}
      {screen === 'progress' && <ProgressScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'welcome-back' && <WelcomeBackScreen />}
      {screen === 'recovery' && <RecoveryScreen />}
      {screen === 'update' && <UpdateScreen />}
      {screen === 'history' && <HistoryScreen />}
      <BottomNav />
    </div>
  )
}

function Page() {
  return (
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  )
}
