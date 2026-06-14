'use client'

import { Search, SlidersHorizontal, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { getWeekDays, formatMinutes } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

export default function PlanScreen() {
  const { state, dispatch } = useStore()
  const { subjects, todaySchedule, sessions } = state

  const weekDays = getWeekDays()

  const totalMinutes = todaySchedule.reduce((acc, i) => acc + i.targetMinutes, 0)

  const todayStr = new Date().toISOString().split('T')[0]
  const today = new Date()
  const monthName = today.toLocaleDateString('en-US', { month: 'long' })
  const dateNum = today.getDate()

  const getStatusBadge = (status: 'in-progress' | 'upcoming' | 'completed') => {
    if (status === 'in-progress')
      return (
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-success/15 text-success">
          In Progress
        </span>
      )
    if (status === 'completed')
      return (
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          Done
        </span>
      )
    return (
      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#FFF3E0] text-[#C47A1A]">
        Upcoming
      </span>
    )
  }

  // Completed sessions for today
  const completedToday = sessions
    .filter((s) => s.date === todayStr)
    .map((s) => ({
      subjectId: s.subjectId,
      lectureId: s.lectureId,
      targetMinutes: s.plannedMinutes,
      status: 'completed' as const,
    }))

  const allItems = [
    ...completedToday,
    ...todaySchedule.filter(
      (i) => !completedToday.some((c) => c.lectureId === i.lectureId)
    ),
  ]

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-2">
        <h1 className="font-heading font-bold text-4xl text-foreground">My Plan</h1>
        <div className="flex items-center justify-between mt-3">
          <p className="text-muted-foreground text-sm">
            Today, {dateNum} {monthName}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
              aria-label="Search"
            >
              <Search size={15} className="text-foreground" />
            </button>
            <button
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
              aria-label="Filter"
            >
              <SlidersHorizontal size={15} className="text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Week calendar strip */}
      <div className="px-5 pt-3 pb-4">
        <div className="flex gap-1 justify-between">
          {weekDays.map(({ day, date, isToday }) => (
            <div key={date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{day}</span>
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                  isToday
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {date}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-base text-foreground">
            Today&apos;s Schedule
          </h2>
          {totalMinutes > 0 && (
            <span className="text-sm font-semibold text-success">
              {formatMinutes(totalMinutes)}
            </span>
          )}
        </div>

        {allItems.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-8 text-center">
            <p className="font-heading font-semibold text-foreground mb-2">No sessions planned</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add subjects and lectures to get started.
            </p>
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
              className="text-sm font-semibold text-primary"
            >
              Manage Subjects
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allItems.map((item) => {
              const sub = subjects.find((s) => s.id === item.subjectId)
              const lec = sub?.lectures.find((l) => l.id === item.lectureId)
              if (!sub || !lec) return null

              const isActive = item.status === 'in-progress'

              return (
                <button
                  key={`${item.subjectId}-${item.lectureId}`}
                  onClick={() => {
                    if (item.status !== 'completed') {
                      dispatch({
                        type: 'START_SESSION',
                        subjectId: item.subjectId,
                        lectureId: item.lectureId,
                        targetMinutes: item.targetMinutes,
                      })
                    }
                  }}
                  className={cn(
                    'w-full bg-card rounded-3xl border p-4 text-left transition-all active:scale-[0.98]',
                    isActive ? 'border-primary/30 shadow-md shadow-primary/5' : 'border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SubjectIcon icon={sub.icon} color={sub.color} size="md" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{sub.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {item.targetMinutes} min
                          </span>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground"
                            aria-label="More options"
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{lec.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          Watch: {lec.watchedMinutes} → {lec.watchedMinutes + item.targetMinutes} min
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* All subjects overview */}
        {subjects.length > 0 && (
          <div className="mt-6">
            <h3 className="font-heading font-semibold text-base text-foreground mb-3">
              All Subjects
            </h3>
            <div className="flex flex-col gap-2.5">
              {subjects.map((subject) => {
                const total = subject.lectures.length
                const done = subject.lectures.filter((l) => l.status === 'completed').length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <div
                    key={subject.id}
                    className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center gap-3"
                  >
                    <SubjectIcon icon={subject.icon} color={subject.color} size="sm" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-foreground">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {done}/{total} lectures
                        </p>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
