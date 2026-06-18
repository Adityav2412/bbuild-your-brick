'use client'

import { ChevronRight, Plus, FolderHeart, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { getSyllabusProgress, formatMinutes } from '@/lib/algorithm'
import SubjectIcon from '@/components/SubjectIcon'

export default function PlanScreen() {
  const { state, dispatch } = useStore()
  const { subjects: allSubjects, todaySchedule, sessions, user } = state
  const subjects = allSubjects.filter((s) => !s.archived)

  if (!user) return null

  const syllabus = getSyllabusProgress(subjects)

  // Subject last studied calculations
  const lastTouchedMap = new Map<string, number>()
  for (const s of sessions) {
    const t = new Date(s.date).getTime()
    lastTouchedMap.set(s.subjectId, Math.max(lastTouchedMap.get(s.subjectId) ?? 0, t))
  }

  // Today's suggested focus
  const todayFocus = todaySchedule[0]
  const suggestedSub = todayFocus ? subjects.find((s) => s.id === todayFocus.subjectId) : null
  const suggestedLec = suggestedSub?.lectures.find((l) => l.id === todayFocus?.lectureId)

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary/80">— The Syllabus —</p>
          <h1 className="font-heading text-4xl text-foreground leading-none mt-1">Subjects</h1>
          <p className="text-muted-foreground text-sm mt-1 italic">Suggested next focus, managed by Brick.</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-warm hover:scale-105 active:scale-95 transition-all"
          aria-label="Add Subjects"
        >
          <Plus size={20} className="text-primary-foreground" />
        </button>
      </div>

      <div className="px-5 mt-2 space-y-6">
        {/* Suggested Next Subject Card (Mockup Tab 5 style) */}
        {suggestedSub && suggestedLec ? (
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 shadow-sm space-y-3.5 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-primary opacity-20">
              <Sparkles size={38} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.18em] leading-none">
                Suggested Next Focus
              </p>
              <h3 className="text-lg font-extrabold text-foreground mt-2 leading-tight">
                {suggestedSub.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Lecture: <span className="text-foreground font-semibold">{suggestedLec.name}</span>
              </p>
            </div>
            
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'home' })}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/95"
            >
              <span>Place Brick Now</span>
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border p-5 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Syllabus Complete! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1 italic">
              All active subject lectures completed. Add new subjects in Settings.
            </p>
          </div>
        )}

        {/* Your Subjects List (Mockup Tab 5) */}
        <div>
          <h3 className="text-base font-extrabold text-foreground tracking-tight mb-3 flex items-center gap-2">
            <FolderHeart size={16} className="text-muted-foreground" />
            Your Subjects
          </h3>

          {subjects.length === 0 ? (
            <div className="bg-card rounded-3xl border border-border p-6 text-center shadow-sm">
              <p className="font-semibold text-foreground text-sm">No active subjects</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add subjects to start rotation building.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {subjects.map((sub) => {
                const total = sub.lectures.length
                const completed = sub.lectures.filter((l) => l.status === 'completed').length
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                
                const lastStudied = lastTouchedMap.get(sub.id)
                const daysAgo = lastStudied != null ? Math.floor((Date.now() - lastStudied) / 86400000) : null

                return (
                  <div
                    key={sub.id}
                    className="bg-card rounded-3xl border border-border p-4.5 flex items-center gap-4.5 shadow-sm"
                  >
                    <SubjectIcon icon={sub.icon} color={sub.color} size="md" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-foreground text-sm truncate leading-none">
                          {sub.name}
                        </p>
                        <span className="text-xs font-bold text-primary leading-none">
                          {pct}%
                        </span>
                      </div>
                      
                      {/* Horizontal progress bar */}
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-success rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-2.5 text-[10px] text-muted-foreground leading-none">
                        <span>{completed}/{total} lectures</span>
                        <span>
                          {daysAgo == null
                            ? 'Not studied yet'
                            : daysAgo === 0
                              ? 'Studied today'
                              : daysAgo === 1
                                ? 'Yesterday'
                                : `${daysAgo}d ago`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Suggested Next Action Queue (Mockup Tab 5 "Today's Stack") */}
        {todaySchedule.length > 1 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                Suggested Actions Queue
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {todaySchedule.length} sessions
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {todaySchedule.slice(1).map((item, idx) => {
                const sub = subjects.find((s) => s.id === item.subjectId)
                const lec = sub?.lectures.find((l) => l.id === item.lectureId)
                if (!sub || !lec) return null
                
                return (
                  <div
                    key={`${item.subjectId}-${item.lectureId}`}
                    className="w-full bg-card rounded-2xl border border-border p-3.5 flex items-center gap-3.5 shadow-sm"
                  >
                    <SubjectIcon icon={sub.icon} color={sub.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-foreground text-xs truncate">
                          {sub.name}
                        </p>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {item.targetMinutes} min
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {lec.name}
                      </p>
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
