'use client'

import { useState } from 'react'
import { Settings, ArrowLeft, Check, Lock, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  getHouseState,
  getSyllabusProgress,
  getHouseScale,
  formatMinutes,
  HOUSE_STAGES,
} from '@/lib/algorithm'
import { resolveStageFrame } from '@/components/HouseScene'

export default function HouseTimelineScreen() {
  const { state, dispatch } = useStore()
  const { user, subjects } = state

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

  // Track which stage is currently selected in the detail card
  const [selectedLevel, setSelectedLevel] = useState<number>(house.level)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true)

  const selectedStage = HOUSE_STAGES[selectedLevel]
  const isCompleted = selectedLevel < house.level
  const isCurrent = selectedLevel === house.level
  const isLocked = selectedLevel > house.level
  
  const frame = resolveStageFrame(selectedStage, isCompleted || isCurrent ? 1 : 0)

  // Dynamic checklists based on stage
  const getStageChecklist = (key: string) => {
    switch (key) {
      case 'foundation':
        return ['Site Cleared', 'Soil Prepared', 'Footing Outlined']
      case 'foundation-complete':
        return ['Concrete Poured', 'Curing Complete', 'Base Leveled']
      case 'walls-rising':
        return ['Wall Panels Installed', 'Stud Framing Placed', 'Corner Bracing Secure']
      case 'window':
        return ['Window Framework Set', 'Glazing Fitted', 'Seals Insulated']
      case 'door':
        return ['Main Threshold Built', 'Hinges Aligned', 'Hardware Mounted']
      case 'roof-framework':
        return ['Trusses Assembled', 'Rafters Lifted', 'Collar Ties Bolted']
      case 'roof-complete':
        return ['Main Roof Done', 'Shingles Laid', 'Flashing Sealed']
      case 'finished-home':
        return ['Siding Finished', 'Electrical Active', 'Interior Polish Complete']
      default:
        return ['Expansion Groundwork Laid', 'Interior Trim Assembled', 'Milestone Finished']
    }
  }

  const checklist = getStageChecklist(selectedStage.key)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3 border-b border-border/40 bg-card/65 backdrop-blur-md sticky top-0 z-40">
        <button
          onClick={() => dispatch({ type: 'GO_BACK' })}
          className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-foreground/80">
          Evolution Timeline
        </span>
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'settings' })}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
        >
          <Settings size={14} className="text-foreground" />
        </button>
      </div>

      <div className="px-5 mt-5 space-y-6">
        {/* Journey Path Track */}
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {HOUSE_STAGES.map((stage, i) => {
            const nodeCompleted = i < house.level
            const nodeCurrent = i === house.level
            const nodeLocked = i > house.level
            const nodeSelected = i === selectedLevel

            return (
              <button
                key={stage.key}
                onClick={() => setSelectedLevel(i)}
                className="w-full text-left flex items-start gap-4 focus:outline-none relative group"
              >
                {/* Node indicator on the path */}
                <div
                  className={cn(
                    'absolute -left-6 w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300',
                    nodeCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : nodeCurrent
                        ? 'bg-background border-primary text-primary scale-110 shadow-warm'
                        : 'bg-background border-border text-muted-foreground/45',
                    nodeSelected && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  )}
                >
                  {nodeCompleted ? (
                    <Check size={10} strokeWidth={3.5} />
                  ) : nodeLocked ? (
                    <Lock size={8} />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                {/* Node card */}
                <div
                  className={cn(
                    'flex-1 bg-card rounded-2xl border p-3.5 transition-all duration-300 shadow-sm hover:shadow-warm',
                    nodeSelected
                      ? 'border-primary bg-primary/[0.02]'
                      : 'border-border/60 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        'text-sm font-extrabold tracking-tight',
                        nodeLocked ? 'text-muted-foreground/60' : 'text-foreground'
                      )}
                    >
                      {stage.label}
                    </p>
                    {stage.isExpansion && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        Expansion
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                    {stage.description}
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30 text-[10px] text-muted-foreground/80">
                    <span>Target: {stage.bricksRequired} Bricks</span>
                    {nodeCompleted && <span className="text-success font-semibold">Completed</span>}
                    {nodeCurrent && <span className="text-primary font-bold">Current Stage</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Floating Detail Overlay Card at bottom / side */}
        <div className="bg-card rounded-[28px] border border-border shadow-warm p-5 sticky bottom-4 z-30 transition-all duration-300">
          <div
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/80">
                {isLocked ? '🔒 Stage Locked' : isCurrent ? '⚡ Current Stage' : '🏆 Completed Stage'}
              </p>
              <h3 className="text-lg font-extrabold text-foreground mt-0.5">
                {selectedStage.label}
              </h3>
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              {isDetailsExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>

          {isDetailsExpanded && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-4 animate-in slide-in-from-bottom-2 duration-250">
              {/* Graphic preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-border/50">
                <img
                  src={frame}
                  alt=""
                  className={cn(
                    'w-full h-full object-cover',
                    isLocked && 'opacity-30 blur-[0.5px] saturate-[0.6]'
                  )}
                />
                {isLocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/25">
                    <div className="p-3 bg-card/90 rounded-full border border-border shadow-md">
                      <Lock size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Progress towards next */}
              {isCurrent && selectedStage.bricksRequired > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                    <span>Progress to Stage Completion</span>
                    <span>{Math.round(house.fraction * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${house.fraction * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Completed Tasks Checklist */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Build Milestones
                </p>
                <div className="space-y-2">
                  {checklist.map((task, idx) => {
                    const taskDone = isCompleted || (isCurrent && house.fraction > (idx / checklist.length))
                    return (
                      <div key={task} className="flex items-center gap-2.5 text-xs text-foreground/80">
                        <div
                          className={cn(
                            'w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0',
                            taskDone
                              ? 'bg-success/10 border-success text-success'
                              : 'border-border text-muted-foreground/30'
                          )}
                        >
                          <Check size={10} strokeWidth={3.5} className={cn(!taskDone && 'opacity-0')} />
                        </div>
                        <span className={cn(taskDone && 'line-through text-muted-foreground/85')}>{task}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stats footer in details card */}
              <div className="grid grid-cols-2 gap-3.5 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block leading-none">Total Bricks</span>
                    <span className="font-bold text-foreground mt-0.5 block leading-none">
                      {isCompleted ? selectedStage.bricksRequired : isLocked ? '—' : house.bricks}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock size={14} className="text-[#6B4A2A] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block leading-none">Min. Required</span>
                    <span className="font-bold text-foreground mt-0.5 block leading-none">
                      {selectedStage.bricksRequired * user.comfortableMinutes}m
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
