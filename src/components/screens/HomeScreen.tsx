'use client'

import { Bell, Play, ChevronRight, Home as HomeIcon, BookOpen } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getGreeting, getMentorMessage, getHouseState, formatMinutes } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

// ─── House of Knowledge Illustration ──────────────────────────────────────────
// Each completed session places one brick. The home evolves visually as the
// student's consistency grows.
//
// Stages: 0 Foundation, 1 Walls, 2 Windows, 3 Door, 4 Roof, 5 Garden, 6 Complete

function HouseIllustration({ level, bricks }: { level: number; bricks: number }) {
  const showWalls = level >= 1
  const showWindows = level >= 2
  const showDoor = level >= 3
  const showRoof = level >= 4
  const showGarden = level >= 5
  const isComplete = level >= 6

  // Animate the most recently placed brick on the front wall
  const wallBricks = Math.min(bricks, 18)

  return (
    <svg viewBox="0 0 100 80" className="w-full h-full" aria-hidden="true">
      {/* Ground line — the foundation is always there */}
      <line x1="6" y1="72" x2="94" y2="72" stroke="#E8D9B8" strokeWidth="1.2" />
      <rect x="22" y="70" width="56" height="3" rx="0.6" fill="#C9B894" opacity="0.9" />

      {/* Garden — soft grass tufts */}
      {showGarden && (
        <g opacity="0.9">
          <path d="M14 72 q1 -4 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M17 72 q1 -3 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M82 72 q1 -4 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          <path d="M85 72 q1 -3 2 0" stroke="#7BB28A" strokeWidth="1" fill="none" />
          {/* A small tree */}
          <rect x="10" y="64" width="1.5" height="8" fill="#7C5A3A" />
          <circle cx="10.7" cy="62" r="4" fill="#4E8A5C" opacity="0.9" />
        </g>
      )}

      {/* Walls (rows of bricks) */}
      {showWalls && (
        <g>
          <rect x="28" y="40" width="44" height="30" rx="1" fill="#D7A878" opacity="0.95" />
          {/* Brick rows */}
          {Array.from({ length: 6 }).map((_, row) => (
            <g key={row}>
              {Array.from({ length: 3 }).map((_, col) => {
                const idx = row * 3 + col
                const isLatest = idx === wallBricks - 1
                if (idx >= wallBricks) return null
                const xOff = row % 2 === 0 ? 0 : 7
                return (
                  <rect
                    key={col}
                    x={29 + col * 14 + xOff}
                    y={42 + row * 4.5}
                    width="13"
                    height="3.6"
                    rx="0.5"
                    fill="#B07A4E"
                    opacity="0.85"
                    className={isLatest ? 'animate-brick-place' : undefined}
                  />
                )
              })}
            </g>
          ))}
          {/* Mortar outline */}
          <rect
            x="28"
            y="40"
            width="44"
            height="30"
            rx="1"
            fill="none"
            stroke="#8B5E3C"
            strokeWidth="0.6"
            opacity="0.5"
          />
        </g>
      )}

      {/* Windows */}
      {showWindows && (
        <g>
          <rect x="33" y="46" width="10" height="10" rx="1" fill="#F5E8A0" opacity="0.95" />
          <line x1="38" y1="46" x2="38" y2="56" stroke="#8B5E3C" strokeWidth="0.5" />
          <line x1="33" y1="51" x2="43" y2="51" stroke="#8B5E3C" strokeWidth="0.5" />

          <rect x="57" y="46" width="10" height="10" rx="1" fill="#F5E8A0" opacity="0.95" />
          <line x1="62" y1="46" x2="62" y2="56" stroke="#8B5E3C" strokeWidth="0.5" />
          <line x1="57" y1="51" x2="67" y2="51" stroke="#8B5E3C" strokeWidth="0.5" />
        </g>
      )}

      {/* Door */}
      {showDoor && (
        <g>
          <rect x="46" y="58" width="8" height="12" rx="1" fill="#6B4226" />
          <circle cx="52" cy="64" r="0.6" fill="#E8D98C" />
        </g>
      )}

      {/* Roof */}
      {showRoof && (
        <g>
          <path d="M24 42 L50 24 L76 42 Z" fill="#2B4B3C" />
          <path d="M24 42 L50 24 L76 42 Z" fill="none" stroke="#1E3828" strokeWidth="0.6" />
          {/* Chimney */}
          <rect x="62" y="28" width="4" height="8" fill="#8B5E3C" />
        </g>
      )}

      {/* Completion shimmer */}
      {isComplete && (
        <g opacity="0.7">
          <circle cx="20" cy="20" r="0.8" fill="#E8D98C" />
          <circle cx="80" cy="16" r="0.8" fill="#E8D98C" />
          <circle cx="50" cy="12" r="1" fill="#F5E8A0" />
        </g>
      )}
    </svg>
  )
}

// ─── House of Knowledge Card ──────────────────────────────────────────────────

function HouseCard() {
  const { state } = useStore()
  const { user } = state
  if (!user) return null

  const house = getHouseState(user.totalSessions)
  const pct = Math.round(house.fraction * 100)

  return (
    <div className="bg-primary rounded-3xl p-5 flex flex-col gap-4 animate-house-grow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">
            The House of Knowledge
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
        <HouseIllustration level={house.level} bricks={house.bricks} />
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
              ? `Next: ${house.nextStage.label} in ${house.bricksToNext} brick${house.bricksToNext !== 1 ? 's' : ''}`
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
  const mentorMessage = user.lastMentorNote || getMentorMessage(user.totalSessions)

  const todayFocus = todaySchedule[0]
  const focusSubject = subjects.find((s) => s.id === todayFocus?.subjectId)
  const focusLecture = focusSubject?.lectures.find((l) => l.id === todayFocus?.lectureId)

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
            className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
            aria-label="Notifications"
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
        {/* Greeting + mentor message */}
        <div>
          <h1 className="font-bold text-3xl text-foreground leading-tight tracking-tight">
            {greeting}, {user.name.split(' ')[0]}.
          </h1>
          <p
            key={mentorMessage}
            className="text-muted-foreground mt-1 text-base leading-relaxed animate-mentor-fade"
          >
            {mentorMessage}
          </p>
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
        ) : (
          <div className="bg-card rounded-3xl border border-border p-6 text-center">
            <p className="font-semibold text-foreground mb-1">All done for today</p>
            <p className="text-sm text-muted-foreground">
              Your next brick is placed tomorrow.
            </p>
          </div>
        )}

        {/* Current Rhythm pill */}
        <div className="flex items-center justify-between px-4 py-3 bg-card rounded-2xl border border-border">
          <p className="text-sm text-muted-foreground">Current Rhythm</p>
          <p className="text-sm font-semibold text-foreground">
            {formatMinutes(user.currentCapacity)}
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
