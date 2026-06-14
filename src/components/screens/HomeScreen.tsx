'use client'

import { Bell, Play, ChevronRight, Telescope, BookOpen } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getGreeting, getMentorMessage, getObservatoryState, formatMinutes } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'
import { cn } from '@/lib/utils'

// ─── Observatory Illustration ─────────────────────────────────────────────────

function ObservatoryIllustration({ level }: { level: number }) {
  // Stars: how many are revealed (0–8)
  const starsVisible = Math.min(level, 8)
  const starPositions = [
    { cx: 52, cy: 18, r: 1.5 },
    { cx: 72, cy: 28, r: 1 },
    { cx: 38, cy: 24, r: 1 },
    { cx: 88, cy: 18, r: 1.5 },
    { cx: 20, cy: 32, r: 1 },
    { cx: 62, cy: 10, r: 1 },
    { cx: 78, cy: 38, r: 1 },
    { cx: 14, cy: 20, r: 1.5 },
  ]

  // Dome opacity based on progress
  const domeOpacity = 0.3 + (level / 10) * 0.7
  // Telescope visible after level 4
  const telescopeVisible = level >= 4
  // Lamp lit after level 3
  const lampLit = level >= 3
  // Roof open after level 8
  const roofOpen = level >= 8

  return (
    <svg viewBox="0 0 100 80" className="w-full h-full" aria-hidden="true">
      {/* Night sky */}
      <rect width="100" height="80" fill="transparent" />

      {/* Stars — revealed progressively */}
      {starPositions.slice(0, starsVisible).map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill={lampLit ? '#E8D98C' : '#C8C4B8'}
          opacity={0.6 + (i % 3) * 0.15}
        />
      ))}

      {/* Observatory base */}
      <rect
        x="18" y="54" width="64" height="22"
        rx="2"
        fill="#2B4B3C"
        opacity={domeOpacity}
      />

      {/* Windows */}
      <rect x="26" y="60" width="8" height="10" rx="1" fill={lampLit ? '#E8D98C' : '#1A3028'} opacity="0.9" />
      <rect x="46" y="60" width="8" height="10" rx="1" fill={lampLit ? '#E8D98C' : '#1A3028'} opacity="0.9" />
      <rect x="66" y="60" width="8" height="10" rx="1" fill={lampLit ? '#F5E8A0' : '#1A3028'} opacity="0.9" />

      {/* Dome */}
      <ellipse cx="50" cy="54" rx="22" ry="4" fill="#1E3828" opacity={domeOpacity} />
      <path
        d="M28 54 Q50 28 72 54"
        fill="#2B4B3C"
        opacity={domeOpacity}
      />

      {/* Dome slit (open when roof repaired) */}
      {roofOpen && (
        <path
          d="M47 40 Q50 32 53 40"
          fill="none"
          stroke="#E8D98C"
          strokeWidth="1.5"
          opacity="0.7"
        />
      )}

      {/* Telescope barrel (visible after level 4) */}
      {telescopeVisible && (
        <g transform="translate(50, 42) rotate(-30)">
          <rect x="-2" y="-12" width="4" height="16" rx="1.5" fill="#4A7A5C" opacity="0.9" />
          <rect x="-3" y="-14" width="6" height="4" rx="1" fill="#3A6A4C" opacity="0.9" />
        </g>
      )}

      {/* Tower lamp glow (lit after level 3) */}
      {lampLit && (
        <>
          <circle cx="17" cy="48" r="3" fill="#E8D98C" opacity="0.15" />
          <circle cx="17" cy="48" r="1.5" fill="#E8D98C" opacity="0.6" />
          <circle cx="83" cy="48" r="3" fill="#E8D98C" opacity="0.15" />
          <circle cx="83" cy="48" r="1.5" fill="#E8D98C" opacity="0.6" />
        </>
      )}

      {/* Towers */}
      <rect x="12" y="44" width="8" height="12" rx="1" fill="#2B4B3C" opacity={domeOpacity} />
      <rect x="80" y="44" width="8" height="12" rx="1" fill="#2B4B3C" opacity={domeOpacity} />

      {/* Ground line */}
      <line x1="5" y1="76" x2="95" y2="76" stroke="#2B4B3C" strokeWidth="1" opacity="0.2" />

      {/* Path (visible after level 1) */}
      {level >= 1 && (
        <path
          d="M50 76 Q50 72 46 70 M50 76 Q50 72 54 70"
          fill="none"
          stroke="#4A7A5C"
          strokeWidth="1"
          opacity="0.4"
        />
      )}
    </svg>
  )
}

// ─── Observatory Card ─────────────────────────────────────────────────────────

function ObservatoryCard() {
  const { state } = useStore()
  const { user } = state
  if (!user) return null

  const obs = getObservatoryState(user.totalSessions)
  const pct = Math.round(obs.fraction * 100)

  return (
    <div className="bg-primary rounded-3xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">
            Observatory
          </p>
          <p className="text-primary-foreground font-semibold text-sm mt-0.5">
            {obs.description}
          </p>
        </div>
        <span className="text-primary-foreground/70 text-xs font-semibold tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Illustration */}
      <div className="h-28 w-full">
        <ObservatoryIllustration level={obs.level} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-primary-foreground/50 text-[10px]">
            {user.totalSessions} session{user.totalSessions !== 1 ? 's' : ''} completed
          </span>
          {obs.recentRestoration && (
            <span className="text-primary-foreground/60 text-[10px]">
              + {obs.recentRestoration}
            </span>
          )}
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
  const mentorMessage = getMentorMessage(user.totalSessions)

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
            <Telescope size={14} className="text-primary-foreground" strokeWidth={1.8} />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">StudyCoach</span>
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
          <p className="text-muted-foreground mt-1 text-base leading-relaxed">
            {mentorMessage}
          </p>
        </div>

        {/* Exam countdown */}
        {daysUntilExam !== null && daysUntilExam <= 90 && (
          <div className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{user.examName}</span>
            <span className="text-sm font-bold text-primary tabular-nums">{daysUntilExam} days left</span>
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
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{focusLecture.name}</p>
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
                    {todaySchedule.slice(1).length} more subject{todaySchedule.slice(1).length !== 1 ? 's' : ''} after this
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
              Your next session starts tomorrow.
            </p>
          </div>
        )}

        {/* Capacity pill */}
        <div className="flex items-center justify-between px-4 py-3 bg-card rounded-2xl border border-border">
          <p className="text-sm text-muted-foreground">Current study capacity</p>
          <p className="text-sm font-semibold text-foreground">{formatMinutes(user.currentCapacity)}/day</p>
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

        {/* Observatory restoration */}
        <ObservatoryCard />
      </div>
    </div>
  )
}
