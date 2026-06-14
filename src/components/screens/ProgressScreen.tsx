'use client'

import { BookOpen, TrendingUp, Sparkles, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { formatMinutes, getHouseState, HOUSE_STAGES } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

// ─── House of Knowledge Timeline ──────────────────────────────────────────────

const STAGE_ICONS: Record<string, string> = {
  foundation: '▥',
  walls: '▦',
  windows: '◫',
  door: '▤',
  roof: '⌂',
  garden: '✿',
  complete: '★',
}

function HouseTimeline({ level, totalBricks }: { level: number; totalBricks: number }) {
  return (
    <div className="relative">
      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />
      <div className="flex flex-col gap-1">
        {HOUSE_STAGES.map((stage, i) => {
          const isCompleted = i <= level
          const isCurrent = i === level
          return (
            <div
              key={stage.key}
              className={cn(
                'flex items-center gap-3 px-2 py-2 rounded-xl transition-all',
                isCurrent && 'bg-primary/8'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all',
                  isCompleted
                    ? isCurrent
                      ? 'bg-primary border-primary'
                      : 'bg-primary/15 border-primary/30'
                    : 'bg-card border-border'
                )}
              >
                <span
                  className={cn(
                    'text-sm leading-none',
                    isCompleted
                      ? isCurrent
                        ? 'text-primary-foreground'
                        : 'text-primary'
                      : 'text-muted-foreground/40'
                  )}
                >
                  {STAGE_ICONS[stage.key]}
                </span>
              </div>

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

              <span
                className={cn(
                  'text-[10px] font-medium shrink-0',
                  isCompleted ? 'text-primary/60' : 'text-muted-foreground/30'
                )}
              >
                {stage.bricksRequired === 0
                  ? 'Start'
                  : `${totalBricks >= stage.bricksRequired ? '✓ ' : ''}${stage.bricksRequired} bricks`}
              </span>
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
  const { user, subjects } = state

  if (!user) return null

  const house = getHouseState(user.totalSessions, user.houseEffortScore)

  // Subject-level progress
  const subjectProgress = subjects.map((s) => {
    const total = s.lectures.length
    const done = s.lectures.filter((l) => l.status === 'completed').length
    return { subject: s, total, done }
  })

  const totalLecturesDone = subjectProgress.reduce((acc, s) => acc + s.done, 0)
  const totalLectures = subjectProgress.reduce((acc, s) => acc + s.total, 0)
  const remainingLectures = Math.max(0, totalLectures - totalLecturesDone)

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-4xl text-foreground tracking-tight">Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">Your home, brick by brick</p>
        </div>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 space-y-5">
        {/* Rhythm row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {formatMinutes(user.comfortableMinutes)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Started Rhythm</p>
            </div>
          </div>

          <div className="bg-primary rounded-3xl p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-3xl text-primary-foreground tracking-tight">
                {formatMinutes(user.currentCapacity)}
              </p>
              <p className="text-xs text-primary-foreground/70 font-medium">
                Today&apos;s Rhythm
              </p>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E0EEFF] flex items-center justify-center">
              <BookOpen size={18} className="text-[#1A72C4]" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {totalLecturesDone}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Lectures Completed</p>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border p-4 flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF3E0] flex items-center justify-center">
              <Layers size={18} className="text-[#C47A1A]" />
            </div>
            <div>
              <p className="font-bold text-3xl text-foreground tracking-tight">
                {remainingLectures}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Remaining Lectures</p>
            </div>
          </div>
        </div>

        {/* House of Knowledge timeline */}
        <div className="bg-card rounded-3xl border border-border p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-base text-foreground tracking-tight">
              House of Knowledge
            </h3>
            <span className="text-xs text-primary font-semibold">
              {Math.round(house.fraction * 100)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            {house.stage.label} — {house.description}
          </p>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${house.fraction * 100}%` }}
            />
          </div>

          <HouseTimeline level={house.level} totalBricks={house.bricks} />
        </div>

        {/* Subject breakdown — simple completion only */}
        {subjectProgress.length > 0 && (
          <div>
            <h3 className="font-semibold text-base text-foreground tracking-tight mb-3">
              By Subject
            </h3>
            <div className="flex flex-col gap-3">
              {subjectProgress.map(({ subject, total, done }) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
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
                        style={{ width: `${pct}%` }}
                      />
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
