'use client'

import { Settings, Sparkles, Clock, History, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  getHouseState,
  getSyllabusProgress,
  getHouseScale,
  formatMinutes,
} from '@/lib/algorithm'
import HouseScene from '@/components/HouseScene'

export default function HouseScreen() {
  const { state, dispatch } = useStore()
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

  // Get recent 3 brick activities (completed sessions)
  const recentBricks = sessions
    .filter((s) => s.completed)
    .slice(-3)
    .reverse()

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3">
        <div className="leading-tight">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary/80">— The Centerpiece —</p>
          <h1 className="text-3xl font-extrabold text-foreground mt-0.5 tracking-tight">Your House</h1>
        </div>
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-warm"
          aria-label="Settings"
        >
          <Settings size={16} className="text-foreground" />
        </button>
      </div>

      <div className="px-5 mt-2 space-y-5">
        {/* Large House Card */}
        <div className="bg-card rounded-[32px] border border-border p-5 shadow-warm space-y-4">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-muted">
            <HouseScene
              stage={house.stage}
              nextStage={house.nextStage}
              stageFraction={house.stageFraction}
              showNextPeek={false} // Hide next peek in the main card since we have details below
            />
          </div>

          <div className="space-y-2 text-center pt-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {scale.label} Stage {house.level + 1}
            </span>
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight mt-2">
              {house.stage.label}
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-xs mx-auto leading-relaxed">
              {house.stage.description}
            </p>
          </div>

          {/* Progress to next upgrade */}
          {house.nextStage ? (
            <div className="bg-background/40 border border-border/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground/80">
                  Next Upgrade: {house.nextStage.label}
                </span>
                <span className="font-bold text-primary">
                  {Math.round(house.fraction * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${house.fraction * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Progress scales linearly with study minutes. You need approximately{' '}
                <span className="font-bold text-foreground">{house.bricksToNext} more bricks</span>{' '}
                ({formatMinutes(Math.ceil((house.nextStage.fractionRequired - house.fraction) * (syllabus.totalMinutes || 1000)))} of study) to unlock the next structure.
              </p>
            </div>
          ) : (
            <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-success">
                🎉 Grand Cabin Completed!
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Your home is fully built. Continue studying to expand the gardens and outbuildings!
              </p>
            </div>
          )}

          {/* Evolution Timeline Trigger Button */}
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'house-timeline' })}
            className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform shadow-warm"
          >
            <span>View Evolution Timeline</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-foreground leading-none">
                {house.bricks}
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                Total Bricks
              </p>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8DECE] flex items-center justify-center shrink-0">
              <Clock size={18} className="text-[#6B4A2A]" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-foreground leading-none truncate">
                {formatMinutes(user.totalMinutes)}
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                Study Time
              </p>
            </div>
          </div>
        </div>

        {/* Recent Brick Activity */}
        <div className="bg-card rounded-3xl border border-border p-5 space-y-3.5">
          <h3 className="font-extrabold text-base text-foreground tracking-tight flex items-center gap-2">
            <History size={16} className="text-muted-foreground" />
            Recent Brick Activity
          </h3>

          {recentBricks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No bricks placed yet. Log your baseline study minutes on the Home screen to place your first brick!
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {recentBricks.map((session) => (
                <div key={session.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {session.subjectName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.lectureName}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                      +1 Brick
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {session.actualMinutes} min · {new Date(session.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
