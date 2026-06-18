'use client'

import { useState } from 'react'
import { Bell, Play, ChevronRight, Home as HomeIcon, BookOpen, AlertCircle, Sparkles } from 'lucide-react'
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
import HouseScene from '@/components/HouseScene'
import type { EnergyLevel } from '@/lib/types'

import StartupRecoveryScreen from './StartupRecoveryScreen'

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { state, dispatch } = useStore()
  const { user, subjects, todaySchedule, screen } = state

  if (!user && screen === 'home') return <StartupRecoveryScreen />
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
  )
  const scale = getHouseScale(syllabus.totalMinutes)

  const daysUntilExam = user.examDate
    ? Math.max(0, Math.ceil((new Date(user.examDate).getTime() - Date.now()) / 86400000))
    : null

  // Modal states & handlers
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<'options' | 'reasons' | 'custom'>('options')
  const [customMinutes, setCustomMinutes] = useState<string>('')

  const handleLogLess = (reason: string) => {
    dispatch({
      type: 'LOG_STUDY_DAY',
      actualMinutes: 0,
      reason,
    })
    closeModal()
  }

  const handleLogBaseline = () => {
    dispatch({
      type: 'LOG_STUDY_DAY',
      actualMinutes: 20,
    })
    closeModal()
  }

  const handleLogCustom = () => {
    const mins = parseInt(customMinutes, 10)
    if (isNaN(mins) || mins <= 0) return
    dispatch({
      type: 'LOG_STUDY_DAY',
      actualMinutes: mins,
    })
    closeModal()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalStep('options')
    setCustomMinutes('')
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
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
            className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
            aria-label="Reminder settings"
          >
            <Bell size={16} className="text-foreground" strokeWidth={1.8} />
          </button>
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
              <span className="text-primary-foreground font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* ─── HERO: The House ─────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary mb-1.5">
            Your {scale.label} of Knowledge
          </p>
          <h1 className="text-[34px] font-extrabold text-foreground leading-[1.05] tracking-[-0.03em] mb-4">
            {house.stage.label}
          </h1>

          <HouseScene
            stage={house.stage}
            nextStage={house.nextStage}
            stageFraction={house.stageFraction}
            showNextPeek={!!house.nextStage}
          />

          {/* Today's quiet line about the build */}
          <p className="text-sm text-foreground/70 italic mt-3 leading-relaxed text-balance">
            {house.stage.description}
          </p>
        </div>

        {/* ─── Mentor's journal note ────────────────────────────────── */}
        <div className="bg-card/70 border border-border/60 rounded-3xl p-5 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <CompanionAvatar size={40} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80 mb-1.5">
                A note from your mentor
              </p>
              <p
                key={mentorMessage}
                className="text-foreground text-[15px] leading-relaxed italic animate-mentor-fade"
              >
                &ldquo;{mentorMessage}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Daily energy check-in removed per product request */}

        {/* Today's Assignment */}
        {todayFocus && focusSubject && focusLecture ? (
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-warm">
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                Today's brick
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
              <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between">
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
          <div className="bg-card rounded-3xl border border-border p-6 text-center">
            <p className="font-bold text-foreground mb-1 tracking-tight">All done for today</p>
            <p className="text-sm text-muted-foreground italic">
              Your next brick is placed tomorrow.
            </p>
          </div>
        )}

        {/* Rhythm + countdown row */}
        <div className="flex items-stretch gap-3">
          <div className="flex-1 px-4 py-3 bg-card rounded-2xl border border-border">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Today's rhythm
            </p>
            <p className="text-base font-extrabold text-foreground tracking-tight">
              {formatMinutes(effectiveRhythm)}
              {todayEnergy && todayEnergy !== 'good' && effectiveRhythm !== user.currentCapacity && (
                <span className="ml-1.5 text-[10px] text-muted-foreground font-medium">
                  ({todayEnergy === 'low' ? 'low' : 'okay'})
                </span>
              )}
            </p>
          </div>
          {daysUntilExam !== null && daysUntilExam <= 120 && (
            <div className="flex-1 px-4 py-3 bg-card rounded-2xl border border-border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate">
                {user.examName}
              </p>
              <p className="text-base font-extrabold text-primary tracking-tight">
                {daysUntilExam}d left
              </p>
            </div>
          )}
        </div>

        {/* Place Today's Brick button */}
        {todayFocus && (
          <button
            onClick={() => {
              setIsModalOpen(true)
              setModalStep('options')
            }}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform shadow-hearth tracking-tight"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" />
            Place Today's Brick
          </button>
        )}
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

            {modalStep === 'options' && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    How much did you study today?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Log today's progress to place your brick.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setModalStep('reasons')}
                    className="w-full h-14 bg-background hover:bg-muted/30 border border-border rounded-2xl font-semibold text-foreground flex items-center justify-between px-5 transition-all active:scale-[0.99]"
                  >
                    <span className="text-sm">Less than 20 minutes</span>
                    <span className="text-muted-foreground text-xs font-normal">No brick awarded</span>
                  </button>

                  <button
                    onClick={handleLogBaseline}
                    className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-between px-5 transition-all active:scale-[0.99] shadow-warm"
                  >
                    <span className="text-sm">20 minutes</span>
                    <span className="text-primary-foreground/85 text-xs font-semibold">Place 1 Brick</span>
                  </button>

                  <button
                    onClick={() => setModalStep('custom')}
                    className="w-full h-14 bg-background hover:bg-muted/30 border border-border rounded-2xl font-semibold text-foreground flex items-center justify-between px-5 transition-all active:scale-[0.99]"
                  >
                    <span className="text-sm">Custom amount</span>
                    <span className="text-muted-foreground text-xs font-normal">Flexible minutes</span>
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

            {modalStep === 'reasons' && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    Why did you study less than 20 minutes today?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Your reason is noted in your study history. We'll ease tomorrow's rhythm.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Health issue', reason: 'Health issue', emoji: '🤒' },
                    { label: 'Low energy', reason: 'Low energy', emoji: '🥱' },
                    { label: 'Emergency', reason: 'Emergency', emoji: '🚨' },
                    { label: 'Busy day', reason: 'Busy day', emoji: '📅' },
                    { label: 'Low motivation', reason: 'Low motivation', emoji: '🧠' },
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
                    onClick={() => setModalStep('options')}
                    className="flex-1 h-12 bg-muted/40 hover:bg-muted/60 text-foreground rounded-2xl text-sm font-bold transition-all"
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
                  {/* Number input and label */}
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

                  {/* Quick add suggestions */}
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

                  {parseInt(customMinutes, 10) < 20 && customMinutes !== '' && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/25 rounded-2xl">
                      <AlertCircle size={15} className="text-destructive shrink-0" />
                      <p className="text-[11px] font-medium text-destructive leading-tight">
                        Under 20 minutes does not award a brick or house progress.
                      </p>
                    </div>
                  )}

                  {parseInt(customMinutes, 10) >= 20 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/25 rounded-2xl">
                      <Sparkles size={15} className="text-primary shrink-0" style={{ transform: 'rotate(15deg)' }} />
                      <p className="text-[11px] font-semibold text-primary leading-tight">
                        Nice! Placing 1 brick and growing your house.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setModalStep('options')}
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
