'use client'

import { useState } from 'react'
import { Calendar, Clock, Award, X, AlertTriangle, Activity, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import type { StudySessionRecord } from '@/lib/types'
import SubjectIcon from '@/components/SubjectIcon'

export default function HistoryScreen() {
  const { state, dispatch } = useStore()
  const { sessions, subjects, user } = state
  const [selectedSession, setSelectedSession] = useState<StudySessionRecord | null>(null)

  if (!user) return null

  // Stats calculations
  const totalStudyMinutes = sessions.reduce((acc, s) => acc + s.actualMinutes, 0)
  const totalBricks = sessions.filter((s) => s.completed).length
  const consistencyRate = sessions.length > 0 
    ? Math.round((totalBricks / sessions.length) * 100) 
    : 0

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary/80">— The Archives —</p>
        <h1 className="font-heading text-4xl text-foreground leading-none mt-1">Study History</h1>
        <p className="text-muted-foreground text-sm mt-1 italic">Review your construction.</p>
      </div>

      <div className="px-5 space-y-6">
        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl border border-border p-3 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              Time
            </span>
            <div className="mt-2">
              <p className="text-xl font-extrabold text-foreground tracking-tight">
                {totalStudyMinutes >= 60 
                  ? `${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m` 
                  : `${totalStudyMinutes}m`}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Total minutes</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-3 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              Bricks
            </span>
            <div className="mt-2">
              <p className="text-xl font-extrabold text-foreground tracking-tight">
                {totalBricks}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Bricks earned</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-3 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              Consistency
            </span>
            <div className="mt-2">
              <p className="text-xl font-extrabold text-foreground tracking-tight">
                {consistencyRate}%
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Brick success rate</p>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <BarChart2 size={13} className="text-muted-foreground/80" /> Logged Days
          </h2>

          {sessions.length === 0 ? (
            <div className="bg-card rounded-3xl border border-border p-8 text-center">
              <p className="font-heading font-semibold text-foreground mb-1">No logs yet</p>
              <p className="text-sm text-muted-foreground italic">
                Logs will appear here once you study and log your minutes.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.slice().reverse().map((session) => {
                const dateObj = new Date(session.date)
                const dateStr = dateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })

                // Find matching subject to resolve color/icon badges
                const matchedSub = subjects.find((s) => s.id === session.subjectId)

                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="w-full text-left bg-card hover:bg-muted/15 active:scale-[0.99] border border-border rounded-3xl p-4 flex items-center justify-between gap-4 transition-all focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      {matchedSub ? (
                        <SubjectIcon icon={matchedSub.icon} color={matchedSub.color} size="sm" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Clock size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono text-muted-foreground leading-none">{dateStr}</p>
                        <p className="text-sm font-bold text-foreground mt-1 truncate">
                          {session.subjectName || 'General Study'}
                        </p>
                        {session.lectureName && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                            {session.lectureName}
                          </p>
                        )}
                        {!session.completed && session.missedReason && (
                          <p className="text-xs text-destructive/85 italic truncate max-w-[200px] mt-0.5">
                            Reason: {session.missedReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-heading text-base text-foreground font-extrabold leading-none">
                        {session.actualMinutes} min
                      </p>
                      <span className={cn(
                        'inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1.5 leading-none border',
                        session.completed 
                          ? 'bg-success/5 text-success border-success/20' 
                          : 'bg-destructive/5 text-destructive border-destructive/20'
                      )}>
                        {session.completed ? '✓ Brick Earned' : '✗ No Brick'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Details Dialog Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm animate-in fade-in duration-200 p-5">
          <div className="absolute inset-0" onClick={() => setSelectedSession(null)} />
          
          <div className="relative w-full max-w-[380px] bg-card rounded-3xl border border-border p-6 shadow-warm animate-in zoom-in-95 duration-200 z-10 flex flex-col gap-5">
            {/* Header / Date */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-primary/80 leading-none">
                  Session Details
                </span>
                <h3 className="font-heading text-lg text-foreground mt-0.5">
                  {new Date(selectedSession.date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/10 active:scale-95 transition-all focus:outline-none"
              >
                <X size={14} className="text-foreground" />
              </button>
            </div>

            {/* Subject/Lecture Box */}
            <div className="bg-muted/40 rounded-2xl border border-border/80 p-3 flex items-center gap-3">
              {subjects.find((s) => s.id === selectedSession.subjectId) ? (
                <SubjectIcon
                  icon={subjects.find((s) => s.id === selectedSession.subjectId)!.icon}
                  color={subjects.find((s) => s.id === selectedSession.subjectId)!.color}
                  size="sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {selectedSession.subjectName || 'General Study'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedSession.lectureName || 'Self-paced review'}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-card rounded-2xl border border-border p-3">
                <span className="text-[10px] text-muted-foreground block leading-none">Studied</span>
                <p className="text-xl font-extrabold text-foreground tracking-tight mt-1">
                  {selectedSession.actualMinutes}m
                </p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3">
                <span className="text-[10px] text-muted-foreground block leading-none">Target Goal</span>
                <p className="text-xl font-extrabold text-foreground tracking-tight mt-1">
                  {selectedSession.plannedMinutes || user.comfortableMinutes}m
                </p>
              </div>
            </div>

            {/* Brick Placement Status */}
            <div className={cn(
              'rounded-2xl border p-4 flex items-start gap-3',
              selectedSession.completed
                ? 'bg-success/5 border-success/20 text-success'
                : 'bg-destructive/5 border-destructive/20 text-destructive'
            )}>
              {selectedSession.completed ? (
                <>
                  <Award size={18} className="shrink-0 mt-0.5 text-success" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold">✓ Daily Brick Placed</p>
                    <p className="text-muted-foreground mt-0.5">
                      You met or exceeded your baseline duration. This day contributes toward your house building.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-destructive" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold">✗ No Brick Placed</p>
                    {selectedSession.missedReason && (
                      <p className="font-semibold text-destructive mt-1">
                        Reason: {selectedSession.missedReason}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1">
                      Daily study minutes did not meet the baseline. No brick is awarded for today.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Extra session metadata if available */}
            {selectedSession.feedback && (
              <div className="flex justify-between items-center px-1 text-xs">
                <span className="text-muted-foreground">Session Ease:</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">
                  {selectedSession.feedback}
                </span>
              </div>
            )}

            {/* Done button */}
            <button
              onClick={() => setSelectedSession(null)}
              className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-2xl text-sm transition-all active:scale-[0.98] shadow-warm mt-1"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
