'use client'

import { useState, useEffect } from 'react'
import { Bell, Play, ChevronRight, Home as HomeIcon, BookOpen, AlertCircle, Sparkles, Settings, LayoutGrid, Award, Trophy, Flame } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  getGreeting,
  getMentorMessage,
  getHouseState,
  getSyllabusProgress,
  getHouseScale,
  formatMinutes,
  daysAway,
  getLogicalStudyDate,
  calculateStreak,
} from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'
import CompanionAvatar from '@/components/CompanionAvatar'
import HouseScene from '@/components/HouseScene'
import type { EnergyLevel } from '@/lib/types'

import StartupRecoveryScreen from './StartupRecoveryScreen'

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { state, dispatch } = useStore()
  const { user, subjects, todaySchedule, screen } = state

  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  if (!user && screen === 'home') return <StartupRecoveryScreen />
  if (!user) return null

  const greeting = getGreeting()
  const today = getLogicalStudyDate(currentTime)
  const hasPlacedToday = state.sessions.some((s) => s.date === today && s.completed)
  const energySetToday = user.energyDate === today
  const todayEnergy: EnergyLevel | null = energySetToday ? (user.todayEnergy ?? null) : null

  const todayFocus = todaySchedule[0]
  const focusSubject = subjects.find((s) => s.id === todayFocus?.subjectId)
  const focusLecture = focusSubject?.lectures.find((l) => l.id === todayFocus?.lectureId)
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

  const getMilestoneTag = (mins: number, baseline: number) => {
    if (mins < baseline) return null
    const diff = mins - baseline
    if (diff >= 60) return { label: 'Baseline Achieved + +60 Min Bonus', bonus: '+60 Min Bonus', icon: '👑' }
    if (diff >= 40) return { label: 'Baseline Achieved + +40 Min Bonus', bonus: '+40 Min Bonus', icon: '🔥' }
    if (diff >= 20) return { label: 'Baseline Achieved + +20 Min Bonus', bonus: '+20 Min Bonus', icon: '✨' }
    if (diff >= 10) return { label: 'Baseline Achieved + +10 Min Bonus', bonus: '+10 Min Bonus', icon: '⚡' }
    return { label: 'Baseline Achieved', bonus: null, icon: '🏆' }
  }

  const lastSession = state.sessions[state.sessions.length - 1] ?? null
  const lastSessionMinutes = lastSession && lastSession.completed && lastSession.date === today ? lastSession.actualMinutes : 0

  const mentorMessage =
    user.lastMentorNote ||
    getMentorMessage({
      totalSessions: user.totalSessions,
      recentFeedback: user.recentFeedback ?? [],
      daysSinceLastStudy: daysAway(user.lastStudyDate),
      recoveryMode: user.recoveryMode,
      progressionPaused: user.progressionPaused,
      energy: todayEnergy,
      totalMinutes: user.totalMinutes,
      lastSessionMinutes,
      houseStageLabel: house.stage.label,
    })

  const daysUntilExam = user.examDate
    ? Math.max(0, Math.ceil((new Date(user.examDate).getTime() - Date.now()) / 86400000))
    : null

  // Modal states & handlers
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<'minutes-entry' | 'below-baseline-flow' | 'custom'>('minutes-entry')
  const [customMinutes, setCustomMinutes] = useState<string>('')
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null)

  // Success screen state
  const [showSuccessView, setShowSuccessView] = useState(false)
  const [lastLoggedMins, setLastLoggedMins] = useState(0)

  const streakInfo = calculateStreak(state.sessions)

  const handleLogLess = (reason: string) => {
    const mins = selectedMinutes ?? 0
    dispatch({
      type: 'LOG_STUDY_DAY',
      actualMinutes: mins,
      reason,
    })
    closeModal()
  }

  const handleLogMinutes = (mins: number) => {
    if (mins < user.comfortableMinutes) {
      setSelectedMinutes(mins)
      setModalStep('below-baseline-flow')
    } else {
      setLastLoggedMins(mins)
      dispatch({
        type: 'LOG_STUDY_DAY',
        actualMinutes: mins,
      })
      setIsModalOpen(false)
      setShowSuccessView(true)
    }
  }

  const handleLogCustom = () => {
    const mins = parseInt(customMinutes, 10)
    if (isNaN(mins) || mins <= 0) return
    if (mins < user.comfortableMinutes) {
      setSelectedMinutes(mins)
      setModalStep('below-baseline-flow')
    } else {
      setLastLoggedMins(mins)
      dispatch({
        type: 'LOG_STUDY_DAY',
        actualMinutes: mins,
      })
      setIsModalOpen(false)
      setShowSuccessView(true)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalStep('minutes-entry')
    setCustomMinutes('')
    setSelectedMinutes(null)
  }

  // Celebratory Success Screen View
  if (showSuccessView) {
    const milestone = getMilestoneTag(lastLoggedMins, user.comfortableMinutes)
    const nextItem = todaySchedule[0] ?? null
    const nextSub = nextItem ? subjects.find((s) => s.id === nextItem.subjectId) : null

    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto px-6 py-10 flex flex-col justify-between max-w-[430px] mx-auto border-x border-border/40">
        <div className="space-y-8 text-center pt-8">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary bg-primary/10 px-3 py-1 rounded-full">
              🏆 Daily Target Achieved
            </span>
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight pt-2">
              Brick Earned!
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Your focus and effort have added another piece to your house.
            </p>
          </div>

          {/* Stacking bricks custom graphics */}
          <div className="flex flex-col gap-1.5 items-center justify-center py-6">
            <div className="flex gap-1.5">
              <div className="w-14 h-5.5 bg-primary/20 rounded-md border border-primary/10" />
              <div className="w-14 h-5.5 bg-primary rounded-md shadow-md animate-bounce" />
            </div>
            <div className="flex gap-1.5 -mt-0.5">
              <div className="w-8 h-5.5 bg-primary rounded-md shadow-sm" />
              <div className="w-14 h-5.5 bg-primary rounded-md shadow-sm" />
              <div className="w-8 h-5.5 bg-primary rounded-md shadow-sm" />
            </div>
            <div className="flex gap-1.5 -mt-0.5">
              <div className="w-14 h-5.5 bg-primary rounded-md shadow-sm" />
              <div className="w-14 h-5.5 bg-primary rounded-md shadow-sm" />
            </div>
          </div>

          {/* Stats breakdown */}
          <div className="bg-card rounded-[28px] border border-border p-5 space-y-4 text-left shadow-warm">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-background/50 border border-border/60 rounded-2xl p-3.5">
                <span className="text-[10px] text-muted-foreground block leading-none">Studied Today</span>
                <span className="text-xl font-extrabold text-foreground mt-1.5 block">
                  {lastLoggedMins} min
                </span>
              </div>
              <div className="bg-background/50 border border-border/60 rounded-2xl p-3.5 flex items-center gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-muted-foreground block leading-none">House Progress</span>
                  <span className="text-xl font-extrabold text-primary mt-1.5 block">
                    +{lastLoggedMins}m
                  </span>
                </div>
              </div>
            </div>

            {/* Streak & Milestones */}
            <div className="flex items-center justify-between p-3.5 bg-primary/[0.02] border border-primary/10 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <Flame size={20} className="text-primary animate-pulse" fill="currentColor" />
                <div>
                  <span className="text-[10px] text-muted-foreground block leading-none">Current Streak</span>
                  <span className="font-extrabold text-foreground mt-0.5 block">
                    {streakInfo.current} {streakInfo.current === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
              {milestone && (
                <div className="flex items-center gap-1 bg-success/15 border border-success/20 px-2.5 py-1 rounded-full">
                  <span className="text-[10px] font-bold text-success">
                    {milestone.icon} {milestone.bonus || 'Baseline'}
                  </span>
                </div>
              )}
            </div>

            {/* Next subject preview */}
            {nextSub && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground block leading-none uppercase tracking-wider">Next Recommended Subject</span>
                <div className="flex items-center gap-2 mt-2">
                  <SubjectIcon icon={nextSub.icon} color={nextSub.color} size="sm" />
                  <span className="text-sm font-bold text-foreground truncate">{nextSub.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-2">
          <button
            onClick={() => setShowSuccessView(false)}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 shadow-warm active:scale-[0.98] transition-transform"
          >
            <span>Keep Building</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-warm">
            <HomeIcon size={15} className="text-primary-foreground" strokeWidth={1.8} />
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-base text-foreground tracking-tight">Brick</span>
            <p className="text-[10px] text-muted-foreground -mt-0.5 font-medium">
              {greeting}, {user.name.split(' ')[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'house-timeline' })}
            className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-warm"
            aria-label="Timeline"
          >
            <LayoutGrid size={16} className="text-foreground" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
            className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-warm"
            aria-label="Settings"
          >
            <Settings size={16} className="text-foreground" strokeWidth={1.8} />
          </button>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover border border-border shadow-sm"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm"
              aria-label={user.name}
            >
              <span className="text-primary-foreground font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* ─── HERO: The House (Dominated 40-50%) ────────────────── */}
        <div className="bg-card rounded-[32px] border border-border p-4.5 shadow-warm space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary/80">
              {scale.label} of Knowledge
            </span>
            <span className="font-semibold text-primary">
              {Math.round(house.fraction * 100)}% Complete
            </span>
          </div>
          
          <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-muted border border-border/40 relative">
            <HouseScene
              stage={house.stage}
              nextStage={house.nextStage}
              stageFraction={house.stageFraction}
              showNextPeek={false}
            />
          </div>

          <div className="px-1 py-1 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-foreground tracking-tight leading-none">
                {house.stage.label}
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">
                {house.stage.description}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Mentor's journal note ────────────────────────────────── */}
        <div className="bg-card/75 border border-border/50 rounded-3xl p-4.5 backdrop-blur-sm shadow-sm">
          <div className="flex items-start gap-3.5">
            <CompanionAvatar size={38} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary/85 mb-1">
                Mentor Note
              </p>
              <p
                key={mentorMessage}
                className="text-foreground text-[14px] leading-relaxed italic animate-mentor-fade"
              >
                &ldquo;{mentorMessage}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Today's Assignment Card */}
        {todayFocus && focusSubject && focusLecture ? (
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-warm">
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                {hasPlacedToday ? "Next Subject" : "Today's brick"} · {user.comfortableMinutes}m baseline
              </p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>

            <div className="px-5 pt-3 pb-5 flex items-center gap-4">
              <SubjectIcon icon={focusSubject.icon} color={focusSubject.color} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-xl font-extrabold text-foreground leading-tight truncate tracking-tight">
                  {focusSubject.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {focusLecture.name}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {todayFocus.targetMinutes} min
                  </span>
                  {todayFocus.watchedFrom > 0 && (
                    <span className="text-xs text-muted-foreground italic">
                      from {todayFocus.watchedFrom}m
                    </span>
                  )}
                </div>
              </div>
            </div>

            {todaySchedule.slice(1).length > 0 && (
              <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between bg-muted/[0.04]">
                <div className="flex items-center gap-2">
                  <BookOpen size={13} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">
                    {todaySchedule.slice(1).length} more subject
                    {todaySchedule.slice(1).length !== 1 ? 's' : ''} after this
                  </span>
                </div>
                <button
                  onClick={() => dispatch({ type: 'NAVIGATE', screen: 'plan' })}
                  className="text-xs text-primary font-bold flex items-center gap-0.5"
                >
                  See all <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        ) : syllabus.totalMinutes > 0 && syllabus.completedMinutes >= syllabus.totalMinutes ? (
          <div className="bg-primary text-primary-foreground rounded-3xl p-6 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/60">
                Journey Complete
              </p>
              <h2 className="font-extrabold text-2xl mt-1 leading-tight tracking-tight">
                Your home is built.
              </h2>
              <p className="text-sm text-primary-foreground/80 mt-1 italic">
                Every brick placed. Every lecture finished. Take a breath — you earned it.
              </p>
            </div>
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
              className="w-full h-11 rounded-2xl bg-white/15 hover:bg-white/20 transition-colors text-sm font-bold"
            >
              Add new subjects to expand your home
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border p-6 text-center shadow-warm">
            <p className="font-bold text-foreground mb-1 tracking-tight">All done for today</p>
            <p className="text-sm text-muted-foreground italic">
              Your next brick is placed tomorrow.
            </p>
          </div>
        )}

        {/* Countdown row */}
        {daysUntilExam !== null && daysUntilExam <= 120 && (
          <div className="px-4 py-3.5 bg-card rounded-2xl border border-border flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              <p className="text-xs text-foreground font-semibold">
                Days until {user.examName}
              </p>
            </div>
            <p className="text-sm font-extrabold text-primary tracking-tight">
              {daysUntilExam} days left
            </p>
          </div>
        )}

        {/* Place Today's Brick CTA */}
        {hasPlacedToday ? (
          <div className="space-y-3">
            <button
              disabled
              className="w-full h-14 bg-muted text-muted-foreground border border-border rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 opacity-70 cursor-not-allowed tracking-tight"
            >
              ✓ Brick Placed Today
            </button>
            <div className="bg-card border border-border rounded-3xl p-4 flex flex-col items-center justify-center gap-2.5 shadow-warm">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Today's Achievements</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-success/10 text-success border border-success/20 px-2.5 py-1 rounded-full">
                  🏆 Baseline Achieved
                </span>
                {(() => {
                  const todaySession = state.sessions.find((s) => s.date === today && s.completed)
                  if (!todaySession) return null
                  const diff = todaySession.actualMinutes - user.comfortableMinutes
                  if (diff >= 60) return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">👑 +60 Min Bonus</span>
                  if (diff >= 40) return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">🔥 +40 Min Bonus</span>
                  if (diff >= 20) return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">✨ +20 Min Bonus</span>
                  if (diff >= 10) return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">⚡ +10 Min Bonus</span>
                  return null
                })()}
              </div>
              <p className="text-center text-xs font-semibold text-muted-foreground mt-1">
                Today's Study: {state.sessions.find((s) => s.date === today && s.completed)?.actualMinutes ?? 0} minutes
              </p>
            </div>
          </div>
        ) : todayFocus ? (
          <button
            onClick={() => {
              setIsModalOpen(true)
              setModalStep('minutes-entry')
            }}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-hearth tracking-tight"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" />
            Place Today's Brick
          </button>
        ) : null}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={closeModal} 
          />
          <div className="relative w-full max-w-[430px] bg-card rounded-t-[32px] border-t border-border px-6 pt-5 pb-10 shadow-warm animate-in slide-in-from-bottom duration-300 ease-out z-10">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6" />

            {modalStep === 'minutes-entry' && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    How many minutes did you study?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Log today's progress to place your brick.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {[15, 20, 30, 45, 60, 90].map((mins) => {
                    const isTarget = mins === user.comfortableMinutes
                    return (
                      <button
                        key={mins}
                        onClick={() => handleLogMinutes(mins)}
                        className={cn(
                          'h-13 rounded-2xl text-sm font-bold transition-all active:scale-[0.96] border flex flex-col items-center justify-center leading-none',
                          isTarget
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background hover:bg-muted/30 border-border text-foreground'
                        )}
                      >
                        <span>{mins}m</span>
                        {isTarget && <span className="text-[8px] mt-0.5 text-primary-foreground/80 font-medium">Baseline</span>}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => setModalStep('custom')}
                    className="w-full h-13 bg-background hover:bg-muted/30 border border-border rounded-2xl font-bold text-foreground flex items-center justify-between px-5 transition-all active:scale-[0.99]"
                  >
                    <span className="text-sm">Custom study time</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full h-11 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors mt-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {modalStep === 'below-baseline-flow' && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    Why did you study below baseline?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Your reason helps us customize tomorrow's study recommendation.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Low Energy', reason: 'Low Energy', emoji: '🥱' },
                    { label: 'Health Issue', reason: 'Health Issue', emoji: '🤒' },
                    { label: 'Busy Day', reason: 'Busy Day', emoji: '📅' },
                    { label: 'Emergency', reason: 'Emergency', emoji: '🚨' },
                    { label: 'Custom', reason: 'Custom', emoji: '✏️' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleLogLess(item.reason)}
                      className="h-16 bg-background hover:bg-muted/30 border border-border rounded-2xl font-semibold text-sm text-foreground flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97]"
                    >
                      <span className="text-lg leading-none">{item.emoji}</span>
                      <span className="text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setModalStep('minutes-entry')}
                    className="w-full h-12 bg-muted/40 hover:bg-muted/60 text-foreground rounded-2xl text-sm font-bold transition-all"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {modalStep === 'custom' && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    Custom Study Time
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Enter total minutes studied today.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={customMinutes}
                      onChange={(e) => {
                        const val = e.target.value
                        if (/^\d*$/.test(val)) {
                          setCustomMinutes(val)
                        }
                      }}
                      placeholder="0"
                      className="flex-1 h-14 bg-background border border-border rounded-2xl text-center text-2xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      autoFocus
                    />
                    <span className="text-base font-bold text-muted-foreground px-1">
                      min
                    </span>
                  </div>

                  <div className="flex justify-between gap-2">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setCustomMinutes(String(mins))}
                        className="flex-1 h-10 bg-muted/40 hover:bg-muted/65 text-foreground rounded-xl text-xs font-bold transition-all active:scale-[0.96]"
                      >
                        {mins}m
                      </button>
                    ))}
                    <button
                      onClick={() => setCustomMinutes('')}
                      className="flex-1 h-10 bg-muted/40 hover:bg-muted/65 text-destructive rounded-xl text-xs font-bold transition-all active:scale-[0.96]"
                    >
                      Clear
                    </button>
                  </div>

                  {parseInt(customMinutes, 10) < user.comfortableMinutes && customMinutes !== '' && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/25 rounded-2xl">
                      <AlertCircle size={15} className="text-destructive shrink-0" />
                      <p className="text-[11px] font-medium text-destructive leading-tight">
                        Under {user.comfortableMinutes} minutes does not award a brick or house progress.
                      </p>
                    </div>
                  )}

                  {parseInt(customMinutes, 10) >= user.comfortableMinutes && (() => {
                    const mins = parseInt(customMinutes, 10)
                    const milestone = getMilestoneTag(mins, user.comfortableMinutes)
                    if (!milestone) return null
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/25 rounded-2xl">
                          <Sparkles size={15} className="text-primary shrink-0" style={{ transform: 'rotate(15deg)' }} />
                          <p className="text-[11px] font-semibold text-primary leading-tight">
                            Nice! Placing 1 brick and growing your house.
                          </p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-2xl p-3 flex flex-col gap-1.5">
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-left">Milestones</p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">
                              🏆 Baseline Achieved
                            </span>
                            {milestone.bonus && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                {milestone.icon} {milestone.bonus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setModalStep('minutes-entry')}
                    className="flex-1 h-13 bg-muted/40 hover:bg-muted/60 text-foreground rounded-2xl text-sm font-bold transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleLogCustom}
                    disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                    className="flex-1 h-13 bg-primary text-primary-foreground disabled:opacity-40 disabled:pointer-events-none rounded-2xl text-sm font-extrabold transition-all shadow-warm"
                  >
                    Log Study Time
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
