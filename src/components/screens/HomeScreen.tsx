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
  const showFoundationBase  = level >= 0
  const showFoundationFull  = level >= 1
  const showWalls           = level >= 2
  const wallsFullyBuilt     = level >= 3
  const showWindow          = level >= 3
  const showDoor            = level >= 4
  const showRoofFrame       = level >= 5
  const showRoofSolid       = level >= 6
  const isFinished          = level >= 7

  const wallRowsTarget = 6
  const wallRows = wallsFullyBuilt
    ? wallRowsTarget
    : level === 2
      ? Math.max(1, Math.round(stageFraction * wallRowsTarget))
      : 0

  const latestBrickIdx = Math.max(0, Math.min(bricks - 1, wallRows * 3 - 1))

  return (
    <svg viewBox="0 0 120 90" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="brick-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F4E4C9" />
          <stop offset="100%" stopColor="#EBD3AE" />
        </linearGradient>
        <linearGradient id="brick-ground" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#D8C19A" />
          <stop offset="100%" stopColor="#B89868" />
        </linearGradient>
        <linearGradient id="brick-wall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C88058" />
          <stop offset="100%" stopColor="#A65E38" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="120" height="80" fill="url(#brick-sky)" rx="3" />
      {/* Sun / lantern */}
      <circle cx="98" cy="18" r="6" fill="#F2C879" opacity={isFinished ? 1 : 0.7} />
      {/* Distant hills */}
      <path d="M0 70 Q 20 56 40 64 T 80 60 T 120 66 L 120 80 L 0 80 Z" fill="#C9AE82" opacity="0.55" />

      {/* Ground */}
      <rect x="0" y="76" width="120" height="14" fill="url(#brick-ground)" />
      <line x1="0" y1="76" x2="120" y2="76" stroke="#8B6F4A" strokeWidth="0.6" opacity="0.4" />

      {/* Foundation outline */}
      {showFoundationBase && !showFoundationFull && (
        <rect x="32" y="72" width="56" height="4" rx="0.6"
          fill="none" stroke="#7C5B3A" strokeWidth="0.8" strokeDasharray="2 1.5" />
      )}
      {showFoundationFull && (
        <g>
          <rect x="32" y="71" width="56" height="5" rx="0.6" fill="#8C6E4A" />
          <rect x="32" y="71" width="56" height="1.2" fill="#A6855E" />
        </g>
      )}

      {/* Walls */}
      {showWalls && (
        <g>
          {wallsFullyBuilt && (
            <rect x="38" y="42" width="44" height="29" rx="0.6" fill="url(#brick-wall)" />
          )}
          {Array.from({ length: wallRows }).map((_, row) => (
            <g key={row}>
              {Array.from({ length: 3 }).map((_, col) => {
                const idx = row * 3 + col
                const isLatest = idx === latestBrickIdx
                const xOff = row % 2 === 0 ? 0 : 7
                const y = 71 - (row + 1) * 4.5
                return (
                  <rect
                    key={col}
                    x={39 + col * 14 + xOff}
                    y={y}
                    width="13"
                    height="3.6"
                    rx="0.4"
                    fill={isLatest ? '#D88A5A' : '#B07A4E'}
                    stroke="#8B5530"
                    strokeWidth="0.25"
                    className={isLatest ? 'animate-brick-place' : undefined}
                  />
                )
              })}
            </g>
          ))}
        </g>
      )}

      {/* Windows */}
      {showWindow && (
        <g>
          <rect x="43" y="48" width="10" height="11" rx="0.6"
            fill={isFinished ? '#FFD982' : '#F0DCA0'} stroke="#6B4226" strokeWidth="0.5" />
          <line x1="48" y1="48" x2="48" y2="59" stroke="#6B4226" strokeWidth="0.4" />
          <line x1="43" y1="53.5" x2="53" y2="53.5" stroke="#6B4226" strokeWidth="0.4" />
          {showDoor && (
            <>
              <rect x="67" y="48" width="10" height="11" rx="0.6"
                fill={isFinished ? '#FFD982' : '#F0DCA0'} stroke="#6B4226" strokeWidth="0.5" />
              <line x1="72" y1="48" x2="72" y2="59" stroke="#6B4226" strokeWidth="0.4" />
              <line x1="67" y1="53.5" x2="77" y2="53.5" stroke="#6B4226" strokeWidth="0.4" />
            </>
          )}
        </g>
      )}

      {/* Door */}
      {showDoor && (
        <g>
          <rect x="56" y="60" width="8" height="11" rx="0.6" fill="#6B4226" />
          <rect x="56" y="60" width="8" height="1" fill="#8C5A36" />
          <circle cx="62" cy="66" r="0.6" fill="#E8D98C" />
        </g>
      )}

      {/* Roof framework */}
      {showRoofFrame && !showRoofSolid && (
        <g stroke="#7C5B3A" fill="none">
          <line x1="34" y1="44" x2="60" y2="26" strokeWidth="1" />
          <line x1="60" y1="26" x2="86" y2="44" strokeWidth="1" />
          <line x1="38" y1="42" x2="60" y2="30" strokeWidth="0.5" />
          <line x1="60" y1="30" x2="82" y2="42" strokeWidth="0.5" />
          <line x1="60" y1="26" x2="60" y2="42" strokeWidth="0.5" />
        </g>
      )}

      {/* Roof solid */}
      {showRoofSolid && (
        <g>
          <path d="M32 44 L60 24 L88 44 Z" fill="#4A3A2A" />
          <path d="M32 44 L60 24 L88 44 Z" fill="none" stroke="#2E2218" strokeWidth="0.6" />
          {/* tile lines */}
          <line x1="36" y1="42" x2="60" y2="28" stroke="#5B4632" strokeWidth="0.3" />
          <line x1="40" y1="40" x2="60" y2="30" stroke="#5B4632" strokeWidth="0.3" />
          <line x1="84" y1="42" x2="60" y2="28" stroke="#5B4632" strokeWidth="0.3" />
          <line x1="80" y1="40" x2="60" y2="30" stroke="#5B4632" strokeWidth="0.3" />
          <rect x="72" y="30" width="4" height="9" fill="#8B5E3C" />
          <rect x="72" y="30" width="4" height="1" fill="#A87852" />
        </g>
      )}

      {/* Finished — chimney smoke, garden, glow */}
      {isFinished && (
        <g>
          <circle cx="74" cy="26" r="1.2" fill="#E8DECE" opacity="0.7" className="animate-ember" />
          <circle cx="75.5" cy="22" r="1.5" fill="#E8DECE" opacity="0.5" />
          <path d="M14 76 q1 -5 2 0" stroke="#5A6B47" strokeWidth="1" fill="none" />
          <path d="M17 76 q1 -4 2 0" stroke="#5A6B47" strokeWidth="1" fill="none" />
          <path d="M102 76 q1 -5 2 0" stroke="#5A6B47" strokeWidth="1" fill="none" />
          <path d="M105 76 q1 -4 2 0" stroke="#5A6B47" strokeWidth="1" fill="none" />
          <rect x="20" y="66" width="1.5" height="10" fill="#7C5A3A" />
          <circle cx="20.7" cy="64" r="4.5" fill="#5A6B47" />
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
    <div className="rounded-3xl overflow-hidden border border-border bg-card shadow-warm animate-house-grow">
      {/* Illustration scene */}
      <div className="relative bg-[#F2E4C8] dark:bg-[#2B2218]">
        <div className="h-40 w-full px-4 pt-3">
          <HouseIllustration level={house.level} bricks={house.bricks} stageFraction={house.stageFraction} />
        </div>
        <div className="absolute top-3 left-4 text-[10px] font-mono uppercase tracking-[0.18em] text-[#7C5B3A] dark:text-primary/80">
          Stage {Math.min(house.level + 1, 7)} of 7
        </div>
        <div className="absolute top-3 right-4 text-[10px] font-mono text-[#7C5B3A] dark:text-primary/80 tabular-nums">
          {pct}%
        </div>
      </div>
      {/* Caption */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Your {scale.label} of Knowledge
        </p>
        <h3 className="font-heading text-2xl text-foreground mt-1 leading-tight">
          {house.stage.label}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 italic">
          {house.stage.description}
        </p>
        <div className="h-1 bg-muted rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${Math.round(house.stageFraction * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">
            {house.bricks} brick{house.bricks !== 1 ? 's' : ''} placed
          </span>
          <span className="text-[11px] text-muted-foreground">
            {house.nextStage ? `Next · ${house.nextStage.label}` : 'Home complete'}
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
