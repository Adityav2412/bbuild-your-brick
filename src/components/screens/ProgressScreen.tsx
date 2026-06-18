'use client'

import { BookOpen, TrendingUp, Sparkles, Layers, Check, Lock, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import {
  formatMinutes,
  getHouseState,
  getSyllabusProgress,
  getHouseScale,
  calculateStreak,
  HOUSE_STAGES,
} from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

export default function ProgressScreen() {
  const { state } = useStore()
  const { user, subjects, sessions } = state

  if (!user) return null

  const syllabus = getSyllabusProgress(subjects)
  const house = getHouseState(
    user.totalSessions,
    user.houseEffortScore,
    syllabus,
    {
      fraction: user.houseProgressFloor ?? 0,
      totalMinutes: user.houseFloorTotalMinutes ?? syllabus.totalMinutes,
    },
    user.totalMinutes,
    user.totalEffectiveMinutes ?? user.totalMinutes,
    user.comfortableMinutes,
  )
  const scale = getHouseScale(syllabus.totalMinutes)
  const streakInfo = calculateStreak(sessions)

  // Subject-level progress
  const subjectProgress = subjects.map((s) => {
    const total = s.lectures.length
    const done = s.lectures.filter((l) => l.status === 'completed').length
    return { subject: s, total, done }
  })

  // Get milestone preview stages (first 3 main stages)
  const previewStages = HOUSE_STAGES.slice(0, 3)

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary/80">— The Journey —</p>
        <h1 className="font-heading text-4xl text-foreground leading-none mt-1">Your Progress</h1>
        <p className="text-muted-foreground text-sm mt-1 italic">Every minute built, remembered.</p>
      </div>

      <div className="px-5 space-y-5">
        {/* Core Stats Dashboard Cards */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Streak Card */}
          <div className="bg-card rounded-3xl border border-border p-4.5 flex flex-col justify-between h-[120px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Streak</span>
              <Flame size={16} className="text-primary" fill="currentColor" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight leading-none">
                {streakInfo.current} Days
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                Longest: {streakInfo.longest} days
              </p>
            </div>
          </div>

          {/* Bricks Card */}
          <div className="bg-card rounded-3xl border border-border p-4.5 flex flex-col justify-between h-[120px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Bricks</span>
              <Sparkles size={16} className="text-[#8B5E2C]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight leading-none">
                {house.bricks}
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                Completed sessions
              </p>
            </div>
          </div>

          {/* Time Studied Card */}
          <div className="bg-card rounded-3xl border border-border p-4.5 flex flex-col justify-between h-[120px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Time</span>
              <TrendingUp size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight leading-none truncate">
                {formatMinutes(user.totalMinutes)}
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                Total hours
              </p>
            </div>
          </div>

          {/* House Completion */}
          <div className="bg-card rounded-3xl border border-border p-4.5 flex flex-col justify-between h-[120px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completion</span>
              <Layers size={16} className="text-success" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight leading-none">
                {Math.round(house.fraction * 100)}%
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                {scale.label} scale
              </p>
            </div>
          </div>
        </div>

        {/* House Milestones Timeline Card (Tab 3 Redesign Style) */}
        <div className="bg-card rounded-3xl border border-border p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-foreground tracking-tight">
              House Milestone Timeline
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current scale of home: <span className="text-foreground font-semibold">{scale.label}</span>
            </p>
          </div>

          <div className="space-y-3">
            {previewStages.map((stage, i) => {
              const stageCompleted = i < house.level
              const stageActive = i === house.level
              const stageLocked = i > house.level

              return (
                <div
                  key={stage.key}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-2xl border transition-all',
                    stageActive
                      ? 'bg-primary/[0.03] border-primary text-foreground'
                      : stageCompleted
                        ? 'bg-muted/10 border-border/50 text-muted-foreground/80'
                        : 'bg-background border-border/40 text-muted-foreground/50'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center border shrink-0',
                        stageCompleted
                          ? 'bg-success border-success text-success-foreground'
                          : stageActive
                            ? 'bg-background border-primary text-primary shadow-sm'
                            : 'border-border'
                      )}
                    >
                      {stageCompleted ? (
                        <Check size={10} strokeWidth={3} />
                      ) : stageLocked ? (
                        <Lock size={8} />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-xs font-bold">
                      Stage {i + 1}: {stage.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
                    {stageCompleted ? 'Done' : stageActive ? 'In Progress' : 'Locked'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Subject Breakdown Card */}
        {subjectProgress.length > 0 && (
          <div className="bg-card rounded-3xl border border-border p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-foreground tracking-tight">
              Subject Progress
            </h3>

            <div className="space-y-3.5">
              {subjectProgress.map(({ subject, total, done }) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <div key={subject.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <SubjectIcon icon={subject.icon} color={subject.color} size="sm" />
                        <span className="font-bold text-foreground truncate">
                          {subject.name}
                        </span>
                      </div>
                      <span className="font-semibold text-primary">{pct}%</span>
                    </div>
                    
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-none text-right">
                      {done} of {total} lectures complete
                    </p>
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
