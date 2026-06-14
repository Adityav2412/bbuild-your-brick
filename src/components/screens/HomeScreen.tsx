'use client'

import { Bell, Play, ChevronRight, Home as HomeIcon, BookOpen } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  getGreeting,
  getMentorMessage,
  getHouseState,
  getSyllabusProgress,
  getHouseScale,
  formatMinutes,
  daysAway,
  adjustCapacityForEnergy,
} from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'
import CompanionAvatar from '@/components/CompanionAvatar'
import type { EnergyLevel } from '@/lib/types'

// ─── House of Knowledge Illustration ──────────────────────────────────────────
// The home is built physically, stage by stage. Each level reveals a new piece
// of the structure — never a static bar.
//
// Stage map (matches HOUSE_STAGES in algorithm.ts):
//   0 Foundation             — ground only
//   1 Foundation Complete    — full base poured
//   2 Walls Rising           — partial brick walls (animates by stageFraction)
//   3 Window Appears         — full walls + first window
//   4 Door Appears           — door cut in
//   5 Roof Framework         — beams overhead, no covering yet
//   6 Roof Complete          — solid roof + chimney
//   7 Finished Home          — lit windows, garden, fully built

function HouseIllustration({
  level,
  bricks,
  stageFraction,
}: {
  level: number
  bricks: number
  stageFraction: number
}) {
  // What is visible at each stage
  const showFoundationBase  = level >= 0
  const showFoundationFull  = level >= 1
  const showWalls           = level >= 2
  const wallsFullyBuilt     = level >= 3
  const showWindow          = level >= 3
  const showDoor            = level >= 4
  const showRoofFrame       = level >= 5
  const showRoofSolid       = level >= 6
  const isFinished          = level >= 7

  // How "tall" the walls are during stage 2 — they grow with stageFraction.
  const wallRowsTarget = 6
  const wallRows = wallsFullyBuilt
    ? wallRowsTarget
    : level === 2
      ? Math.max(1, Math.round(stageFraction * wallRowsTarget))
      : 0

  // Latest placed brick — small animated highlight
  const latestBrickIdx = Math.max(0, Math.min(bricks - 1, wallRows * 3 - 1))

  return (
    <svg viewBox="0 0 100 80" className="w-full h-full" aria-hidden="true">
      {/* Ground line — always present */}
      <line x1="6" y1="72" x2="94" y2="72" stroke="#E8D9B8" strokeWidth="1.2" />

      {/* Foundation — stage 0: outline only; stage 1+: full solid base */}
      {showFoundationBase && !showFoundationFull && (
        <rect
          x="22" y="70" width="56" height="3" rx="0.6"
          fill="none" stroke="#C9B894" strokeWidth="0.8" strokeDasharray="2 1.5"
        />
      )}
      {showFoundationFull && (
        <rect x="22" y="69" width="56" height="4" rx="0.6" fill="#C9B894" />
      )}

      {/* Walls (rows of bricks) — grow during Walls Rising, full by Window stage */}
      {showWalls && (
        <g>
          {/* Wall back-fill appears once walls are fully built so it doesn't show through partial bricks */}
          {wallsFullyBuilt && (
            <rect x="28" y="40" width="44" height="30" rx="1" fill="#D7A878" opacity="0.95" />
          )}
          {Array.from({ length: wallRows }).map((_, row) => (
            <g key={row}>
              {Array.from({ length: 3 }).map((_, col) => {
                const idx = row * 3 + col
                const isLatest = idx === latestBrickIdx
                const xOff = row % 2 === 0 ? 0 : 7
                const y = 70 - (row + 1) * 4.5
                return (
                  <rect
                    key={col}
                    x={29 + col * 14 + xOff}
                    y={y}
                    width="13"
                    height="3.6"
                    rx="0.5"
                    fill="#B07A4E"
                    opacity="0.9"
                    className={isLatest ? 'animate-brick-place' : undefined}
                  />
                )
              })}
            </g>
          ))}
          {wallsFullyBuilt && (
            <rect x="28" y="40" width="44" height="30" rx="1"
              fill="none" stroke="#8B5E3C" strokeWidth="0.6" opacity="0.5" />
          )}
        </g>
      )}

      {/* Window — appears at stage 3, second window at stage 4+ */}
      {showWindow && (
        <g>
          <rect x="33" y="46" width="10" height="10" rx="1"
            fill={isFinished ? '#FFE9A6' : '#F5E8A0'} opacity="0.95" />
          <line x1="38" y1="46" x2="38" y2="56" stroke="#8B5E3C" strokeWidth="0.5" />
          <line x1="33" y1="51" x2="43" y2="51" stroke="#8B5E3C" strokeWidth="0.5" />
          {showDoor && (
            <>
              <rect x="57" y="46" width="10" height="10" rx="1"
                fill={isFinished ? '#FFE9A6' : '#F5E8A0'} opacity="0.95" />
              <line x1="62" y1="46" x2="62" y2="56" stroke="#8B5E3C" strokeWidth="0.5" />
              <line x1="57" y1="51" x2="67" y2="51" stroke="#8B5E3C" strokeWidth="0.5" />
            </>
          )}
        </g>
      )}

      {/* Door — appears at stage 4 */}
      {showDoor && (
        <g>
          <rect x="46" y="58" width="8" height="12" rx="1" fill="#6B4226" />
          <circle cx="52" cy="64" r="0.6" fill="#E8D98C" />
        </g>
      )}

      {/* Roof framework — stage 5 only (beams, no covering) */}
      {showRoofFrame && !showRoofSolid && (
        <g>
          <line x1="24" y1="42" x2="50" y2="24" stroke="#8B5E3C" strokeWidth="1" />
          <line x1="50" y1="24" x2="76" y2="42" stroke="#8B5E3C" strokeWidth="1" />
          <line x1="28" y1="40" x2="50" y2="28" stroke="#A88463" strokeWidth="0.5" />
          <line x1="50" y1="28" x2="72" y2="40" stroke="#A88463" strokeWidth="0.5" />
          <line x1="50" y1="24" x2="50" y2="40" stroke="#A88463" strokeWidth="0.5" />
        </g>
      )}

      {/* Roof solid — stage 6+ */}
      {showRoofSolid && (
        <g>
          <path d="M24 42 L50 24 L76 42 Z" fill="#2B4B3C" />
          <path d="M24 42 L50 24 L76 42 Z" fill="none" stroke="#1E3828" strokeWidth="0.6" />
          <rect x="62" y="28" width="4" height="8" fill="#8B5E3C" />
        </g>
      )}

      {/* Finished — garden + warm window glow */}
      {isFinished && (
        <g opacity="0.95">
          <path d="M14 72 q1 -4 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M17 72 q1 -3 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M82 72 q1 -4 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M85 72 q1 -3 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <rect x="10" y="64" width="1.5" height="8" fill="#7C5A3A" />
          <circle cx="10.7" cy="62" r="4" fill="#4E8A5C" opacity="0.9" />
          <circle cx="50" cy="14" r="1" fill="#F5E8A0" />
        </g>
      )}
    </svg>
  )
}

// ─── House of Knowledge Card ──────────────────────────────────────────────────

function HouseCard() {
  const { state } = useStore()
  const { user, subjects } = state
  if (!user) return null

  const syllabus = getSyllabusProgress(subjects)
  const house = getHouseState(user.totalSessions, user.houseEffortScore, syllabus, { fraction: user.houseProgressFloor ?? 0, totalMinutes: user.houseFloorTotalMinutes ?? syllabus.totalMinutes })
  const scale = getHouseScale(syllabus.totalMinutes)
  const pct = Math.round(house.fraction * 100)

  return (
    <div className="bg-primary rounded-3xl p-5 flex flex-col gap-4 animate-house-grow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">
            Your {scale.label} of Knowledge
          </p>
          <p className="text-primary-foreground font-semibold text-sm mt-0.5">
            {house.stage.label} — {house.stage.description}
          </p>
        </div>
        <span className="text-primary-foreground/70 text-xs font-semibold tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Illustration */}
      <div className="h-28 w-full">
        <HouseIllustration level={house.level} bricks={house.bricks} stageFraction={house.stageFraction} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-1000"
            style={{ width: `${Math.round(house.stageFraction * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-primary-foreground/50 text-[10px]">
            {house.bricks} brick{house.bricks !== 1 ? 's' : ''} placed
          </span>
          <span className="text-primary-foreground/60 text-[10px]">
            {house.nextStage
              ? `Next: ${house.nextStage.label}`
              : 'Home complete'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { state, dispatch } = useStore()
  const { user, subjects, todaySchedule } = state

  if (!user) return null

  const greeting = getGreeting()
  const today = new Date().toISOString().split('T')[0]
  const energySetToday = user.energyDate === today
  const todayEnergy: EnergyLevel | null = energySetToday ? (user.todayEnergy ?? null) : null

  const mentorMessage =
    user.lastMentorNote ||
    getMentorMessage({
      totalSessions: user.totalSessions,
      recentFeedback: user.recentFeedback ?? [],
      daysSinceLastStudy: daysAway(user.lastStudyDate),
      recoveryMode: user.recoveryMode,
      progressionPaused: user.progressionPaused,
      energy: todayEnergy,
    })

  const effectiveRhythm = adjustCapacityForEnergy(user.currentCapacity, todayEnergy)

  const setEnergy = (e: EnergyLevel) => dispatch({ type: 'SET_ENERGY', energy: e })

  const todayFocus = todaySchedule[0]
  const focusSubject = subjects.find((s) => s.id === todayFocus?.subjectId)
  const focusLecture = focusSubject?.lectures.find((l) => l.id === todayFocus?.lectureId)
  const syllabus = getSyllabusProgress(subjects)

  const daysUntilExam = user.examDate
    ? Math.max(0, Math.ceil((new Date(user.examDate).getTime() - Date.now()) / 86400000))
    : null

  const startSession = () => {
    if (!todayFocus) return
    dispatch({
      type: 'START_SESSION',
      subjectId: todayFocus.subjectId,
      lectureId: todayFocus.lectureId,
      targetMinutes: todayFocus.targetMinutes,
    })
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <HomeIcon size={14} className="text-primary-foreground" strokeWidth={1.8} />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">Brick</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
            className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
            aria-label="Reminder settings"
          >
            <Bell size={16} className="text-foreground" strokeWidth={1.8} />
          </button>
          {/* Avatar */}
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover border border-border"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"
              aria-label={user.name}
            >
              <span className="text-primary-foreground font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Greeting + mentor message + companion */}
        <div>
          <h1 className="font-bold text-3xl text-foreground leading-tight tracking-tight">
            {greeting}, {user.name.split(' ')[0]}.
          </h1>
          <div className="mt-2 flex items-start gap-3">
            <CompanionAvatar size={36} className="mt-0.5" />
            <p
              key={mentorMessage}
              className="text-muted-foreground text-base leading-relaxed animate-mentor-fade flex-1"
            >
              {mentorMessage}
            </p>
          </div>
        </div>

        {/* Exam countdown */}
        {daysUntilExam !== null && daysUntilExam <= 90 && (
          <div className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{user.examName}</span>
            <span className="text-sm font-bold text-primary tabular-nums">
              {daysUntilExam} days left
            </span>
          </div>
        )}

        {/* Daily Energy Check-In — appears once per day */}
        {!energySetToday && (
          <div className="bg-card rounded-3xl border border-border px-4 py-4">
            <p className="text-sm font-semibold text-foreground">How are you feeling today?</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Brick will tune today's session to match.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'good' as const, emoji: '😊', label: 'Good' },
                { value: 'okay' as const, emoji: '🙂', label: 'Okay' },
                { value: 'low' as const, emoji: '😴', label: 'Low' },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => setEnergy(o.value)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background py-3 hover:border-primary/40 transition-colors"
                >
                  <span className="text-xl leading-none">{o.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Today's Assignment Card */}
        {todayFocus && focusSubject && focusLecture ? (
          <div className="bg-card rounded-3xl border border-border overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Today&apos;s Assignment
              </p>
            </div>

            <div className="px-4 pt-2 pb-4 flex items-center gap-4">
              <SubjectIcon icon={focusSubject.icon} color={focusSubject.color} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xl text-foreground leading-tight tracking-tight truncate">
                  {focusSubject.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {focusLecture.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                    {todayFocus.targetMinutes} min
                  </span>
                  {todayFocus.watchedFrom > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Continue from {todayFocus.watchedFrom}m
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming in same card */}
            {todaySchedule.slice(1).length > 0 && (
              <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={13} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {todaySchedule.slice(1).length} more subject
                    {todaySchedule.slice(1).length !== 1 ? 's' : ''} after this
                  </span>
                </div>
                <button
                  onClick={() => dispatch({ type: 'NAVIGATE', screen: 'plan' })}
                  className="text-xs text-primary font-medium flex items-center gap-0.5"
                >
                  See all <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        ) : syllabus.totalMinutes > 0 && syllabus.completedMinutes >= syllabus.totalMinutes ? (
          <div className="bg-primary text-primary-foreground rounded-3xl p-6 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/60">
                Journey Complete
              </p>
              <h2 className="font-bold text-2xl mt-1 leading-tight">
                Your home is built.
              </h2>
              <p className="text-sm text-primary-foreground/80 mt-1">
                Every brick placed. Every lecture finished. Take a breath — you earned it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">Lectures</p>
                <p className="font-bold text-lg">{subjects.filter((s) => !s.archived).reduce((n, s) => n + s.lectures.filter((l) => l.status === 'completed').length, 0)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">Total minutes</p>
                <p className="font-bold text-lg">{user.totalMinutes}</p>
              </div>
            </div>
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
              className="w-full h-11 rounded-2xl bg-white/15 hover:bg-white/20 transition-colors text-sm font-semibold"
            >
              Add new subjects to expand your home
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border p-6 text-center">
            <p className="font-semibold text-foreground mb-1">All done for today</p>
            <p className="text-sm text-muted-foreground">
              Your next brick is placed tomorrow.
            </p>
          </div>
        )}

        {/* Today's Rhythm pill */}
        <div className="flex items-center justify-between px-4 py-3 bg-card rounded-2xl border border-border">
          <p className="text-sm text-muted-foreground">Today&apos;s Rhythm</p>
          <p className="text-sm font-semibold text-foreground">
            {formatMinutes(effectiveRhythm)}
            {todayEnergy && todayEnergy !== 'good' && effectiveRhythm !== user.currentCapacity && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({todayEnergy === 'low' ? 'low energy' : 'okay'})
              </span>
            )}
          </p>
        </div>


        {/* Start Session button */}
        {todayFocus && (
          <button
            onClick={startSession}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" />
            Begin Session
          </button>
        )}

        {/* House of Knowledge */}
        <HouseCard />
      </div>
    </div>
  )
}
