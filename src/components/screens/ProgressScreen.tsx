'use client'

import { Clock, BookOpen, BarChart2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { formatMinutes, getObservatoryState } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

// ─── Observatory Restoration Timeline ─────────────────────────────────────────

const RESTORATION_STAGES = [
  { icon: '🌑', label: 'Forgotten', description: 'Paths overgrown' },
  { icon: '🛤', label: 'Unlocked', description: 'Paths cleared' },
  { icon: '🧹', label: 'Swept', description: 'Hall cleaned' },
  { icon: '🕯', label: 'First lamp', description: 'Light returns' },
  { icon: '🔭', label: 'Telescope', description: 'Lens polished' },
  { icon: '🗺', label: 'Star charts', description: 'Maps unrolled' },
  { icon: '✦', label: 'Mapped', description: 'First constellation' },
  { icon: '🗼', label: 'Tower lit', description: 'Second lamp' },
  { icon: '🌌', label: 'Open sky', description: 'Roof repaired' },
  { icon: '📜', label: 'Maps restored', description: 'Ancient records' },
  { icon: '🌟', label: 'Complete', description: 'Fully operational' },
]

function ObservatoryTimeline({ level }: { level: number }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />

      <div className="flex flex-col gap-1">
        {RESTORATION_STAGES.map((stage, i) => {
          const isCompleted = i <= level
          const isCurrent = i === level
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 px-2 py-2 rounded-xl transition-all',
                isCurrent && 'bg-primary/8'
              )}
            >
              {/* Node */}
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 z-10 border-2 transition-all',
                  isCompleted
                    ? isCurrent
                      ? 'bg-primary border-primary'
                      : 'bg-primary/15 border-primary/30'
                    : 'bg-card border-border'
                )}
              >
                <span
                  className={cn(
                    'text-sm',
                    !isCompleted && 'opacity-30'
                  )}
                >
                  {stage.icon}
                </span>
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-semibold leading-tight',
                    isCompleted
                      ? isCurrent
                        ? 'text-primary'
                        : 'text-foreground'
                      : 'text-muted-foreground/50'
                  )}
                >
                  {stage.label}
                </p>
                <p
                  className={cn(
                    'text-xs',
                    isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/30'
                  )}
                >
                  {stage.description}
                </p>
              </div>

              {/* Session marker */}
              {i > 0 && i <= level && (
                <span className="text-[10px] text-primary/60 font-medium shrink-0">
                  Session {i}
                </span>
              )}
              {i > 0 && i > level && (
                <span className="text-[10px] text-muted-foreground/30 font-medium shrink-0">
                  Session {i}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { state } = useStore()
  const { user, subjects, sessions } = state

  if (!user) return null

  const obs = getObservatoryState(user.totalSessions)

  // Last 7 days study data
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
    const minutes = sessions
      .filter((s) => s.date === dateStr)
      .reduce((acc, s) => acc + s.actualMinutes, 0)
    return { dateStr, dayLabel, minutes }
  })

  const maxMinutes = Math.max(...last7.map((d) => d.minutes), 1)

  // Subject-level progress
  const subjectProgress = subjects.map((s) => {
    const total = s.lectures.length
    const done = s.lectures.filter((l) => l.status === 'completed').length
    const totalMinutes = s.lectures.reduce((acc, l) => acc + l.durationMinutes, 0)
    const watchedMinutes = s.lectures.reduce((acc, l) => acc + l.watchedMinutes, 0)
    return { subject: s, total, done, totalMinutes, watchedMinutes }
  })

  const totalLecturesDone = subjectProgress.reduce((acc, s) => acc + s.done, 0)
  const totalLectures = subjectProgress.reduce((acc, s) => acc + s.total, 0)

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="font-bold text-4xl text-foreground tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">Your restoration journey</p>
      </div>

      <div className="px-5 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total studied */}
          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E2F5EC] flex items-center justify-center">
              <Clock size={18} className="text-[#2B7A52]" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {formatMinutes(user.totalMinutes)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Total Studied</p>
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#EEE8FF] flex items-center justify-center">
              <TrendingUp size={18} className="text-[#7C5CC4]" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {user.totalSessions}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Sessions Done</p>
            </div>
          </div>

          {/* Lectures done */}
          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E0EEFF] flex items-center justify-center">
              <BookOpen size={18} className="text-[#1A72C4]" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {totalLecturesDone}
                <span className="text-base font-medium text-muted-foreground">/{totalLectures}</span>
              </p>
              <p className="text-xs text-muted-foreground font-medium">Lectures Done</p>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-primary rounded-3xl p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-3xl text-primary-foreground tracking-tight">
                {formatMinutes(user.currentCapacity)}
              </p>
              <p className="text-xs text-primary-foreground/70 font-medium">Daily capacity</p>
            </div>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-card rounded-3xl border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-base text-foreground tracking-tight">This Week</h3>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BarChart2 size={14} />
              <span className="text-xs font-medium">minutes / day</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-24">
            {last7.map((day) => {
              const height = day.minutes > 0 ? Math.max((day.minutes / maxMinutes) * 100, 8) : 0
              const isToday = day.dateStr === new Date().toISOString().split('T')[0]
              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className={cn(
                        'w-full rounded-t-lg transition-all duration-500',
                        isToday ? 'bg-primary' : day.minutes > 0 ? 'bg-primary/40' : 'bg-muted'
                      )}
                      style={{ height: height > 0 ? `${height}%` : '4px' }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      isToday ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {day.dayLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Observatory restoration timeline */}
        <div className="bg-card rounded-3xl border border-border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-base text-foreground tracking-tight">
              Observatory Restoration
            </h3>
            <span className="text-xs text-primary font-semibold">
              {Math.round(obs.fraction * 100)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">{obs.description}</p>

          {/* Compact progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${obs.fraction * 100}%` }}
            />
          </div>

          <ObservatoryTimeline level={obs.level} />
        </div>

        {/* Subject breakdown */}
        {subjectProgress.length > 0 && (
          <div>
            <h3 className="font-semibold text-base text-foreground tracking-tight mb-3">
              By Subject
            </h3>
            <div className="flex flex-col gap-3">
              {subjectProgress.map(({ subject, total, done, totalMinutes, watchedMinutes }) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                const watchPct =
                  totalMinutes > 0 ? Math.round((watchedMinutes / totalMinutes) * 100) : 0
                return (
                  <div
                    key={subject.id}
                    className="bg-card rounded-3xl border border-border p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <SubjectIcon icon={subject.icon} color={subject.color} size="sm" />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-semibold text-foreground">{subject.name}</p>
                          <p className="text-xs font-semibold text-primary">{pct}%</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {done}/{total} lectures complete
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all duration-500"
                        style={{ width: `${watchPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatMinutes(watchedMinutes)} watched
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatMinutes(totalMinutes)} total
                      </span>
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
