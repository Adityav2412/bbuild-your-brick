'use client'

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react'
import type {
  Screen,
  User,
  Subject,
  StudySessionRecord,
  TodayScheduleItem,
  SubjectColor,
  SubjectIcon,
  SessionFeedback,
  EnergyLevel,
} from './types'
import {
  buildTodaySchedule,
  adjustCapacityFromStudyTime,
  getReasonRecoveryMessage,
  getLogicalStudyDate,
  isLongGap,
  daysAway,
  adjustCapacityForEnergy,
  applyMissedDayRecovery,
  computeEffortScore,
  computeEnergyHonesty,
  getSyllabusProgress,
  getHouseState,
  getMentorMessage,
  SUBJECT_COLORS,
  SUBJECT_ICONS,
} from './algorithm'
import { startReminderScheduler, stopReminderScheduler } from './reminders'
import { createEmergencyBackup } from './backup'

// ─── State ────────────────────────────────────────────────────────────────────

export interface AppState {
  screen: Screen
  previousScreen: Screen | null
  user: User | null
  subjects: Subject[]
  sessions: StudySessionRecord[]
  todaySchedule: TodayScheduleItem[]
  onboardingStep: number
  draft: {
    name: string
    examName: string
    examDate: string
    comfortableMinutes: number
    maxRhythm: number
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'GO_BACK' }
  | { type: 'SET_ONBOARDING_STEP'; step: number }
  | { type: 'UPDATE_DRAFT'; draft: Partial<AppState['draft']> }
  | { type: 'COMPLETE_ONBOARDING'; subjects: Subject[] }
  | { type: 'ADD_SUBJECTS'; subjects: Subject[] }
  | { type: 'UPDATE_SUBJECT'; subject: Subject }
  | { type: 'DELETE_SUBJECT'; subjectId: string }
  | { type: 'ARCHIVE_SUBJECT'; subjectId: string }
  | { type: 'UNARCHIVE_SUBJECT'; subjectId: string }
  | { type: 'LOG_STUDY_DAY'; actualMinutes: number; reason?: string }
  | { type: 'SET_ENERGY'; energy: EnergyLevel }
  | { type: 'EXIT_RECOVERY'; comfortableMinutes: number }
  | { type: 'UPDATE_USER'; updates: Partial<User> }
  | { type: 'UPDATE_AVATAR'; avatarUrl: string | null }
  | { type: 'RESET_APP' }
  | { type: 'HYDRATE'; state: Partial<AppState> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString(): string {
  return getLogicalStudyDate()
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

/** Computes today's effective rhythm by applying the daily energy modifier. */
function effectiveCapacity(user: User): number {
  const isToday = user.energyDate === todayString()
  const energy = isToday ? user.todayEnergy ?? null : null
  const honesty = computeEnergyHonesty(user.energyHistory)
  return adjustCapacityForEnergy(user.currentCapacity, energy, honesty)
}

function subjectHasProgress(sub: Subject): boolean {
  return sub.lectures.some((l) => l.status === 'completed' || l.watchedMinutes > 0)
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AppState = {
  screen: 'welcome',
  previousScreen: null,
  user: null,
  subjects: [],
  sessions: [],
  todaySchedule: [],
  onboardingStep: 0,
  draft: {
    name: '',
    examName: '',
    examDate: '',
    comfortableMinutes: 20,
    maxRhythm: 120,
  },
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, previousScreen: state.screen, screen: action.screen }

    case 'GO_BACK':
      return {
        ...state,
        screen: state.previousScreen ?? 'home',
        previousScreen: null,
      }

    case 'SET_ONBOARDING_STEP':
      return { ...state, onboardingStep: action.step }

    case 'UPDATE_DRAFT':
      return { ...state, draft: { ...state.draft, ...action.draft } }

    case 'COMPLETE_ONBOARDING': {
      const { draft } = state
      const user: User = {
        name: draft.name || 'Student',
        examName: draft.examName,
        examDate: draft.examDate,
        comfortableMinutes: draft.comfortableMinutes,
        currentCapacity: draft.comfortableMinutes,
        maxRhythm: Math.max(draft.maxRhythm, draft.comfortableMinutes),
        lastStudyDate: null,
        onboardingComplete: true,
        totalSessions: 0,
        totalMinutes: 0,
        joinDate: todayString(),
        avatarUrl: null,
        recentFeedback: [],
        confidenceScore: 0,
        todayEnergy: null,
        energyDate: null,
        recoveryMode: false,
        houseEffortScore: 0,
        houseProgressFloor: 0,
        houseFloorTotalMinutes: 0,
        energyHistory: [],
      }
      const schedule = buildTodaySchedule(action.subjects, effectiveCapacity(user), state.sessions)
      return {
        ...state,
        user,
        subjects: action.subjects,
        todaySchedule: schedule,
        screen: 'home',
        previousScreen: null,
      }
    }

    case 'ADD_SUBJECTS': {
      const merged = [...state.subjects]
      for (const sub of action.subjects) {
        const idx = merged.findIndex((s) => s.id === sub.id)
        if (idx >= 0) merged[idx] = sub
        else merged.push(sub)
      }
      const schedule = state.user
        ? buildTodaySchedule(merged, effectiveCapacity(state.user), state.sessions)
        : state.todaySchedule
      return { ...state, subjects: merged, todaySchedule: schedule }
    }

    case 'UPDATE_SUBJECT': {
      const subjects = state.subjects.map((s) =>
        s.id === action.subject.id ? action.subject : s
      )
      const schedule = state.user
        ? buildTodaySchedule(subjects, effectiveCapacity(state.user), state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'DELETE_SUBJECT': {
      // Subjects with progress cannot be permanently deleted — they are archived
      // to preserve history, completed minutes, and house progress integrity.
      const target = state.subjects.find((s) => s.id === action.subjectId)
      const hasProgress = target ? subjectHasProgress(target) : false
      const subjects = hasProgress
        ? state.subjects.map((s) =>
            s.id === action.subjectId ? { ...s, archived: true } : s,
          )
        : state.subjects.filter((s) => s.id !== action.subjectId)
      const schedule = state.user
        ? buildTodaySchedule(subjects, effectiveCapacity(state.user), state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'ARCHIVE_SUBJECT': {
      const subjects = state.subjects.map((s) =>
        s.id === action.subjectId ? { ...s, archived: true } : s,
      )
      const schedule = state.user
        ? buildTodaySchedule(subjects, effectiveCapacity(state.user), state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'UNARCHIVE_SUBJECT': {
      const subjects = state.subjects.map((s) =>
        s.id === action.subjectId ? { ...s, archived: false } : s,
      )
      const schedule = state.user
        ? buildTodaySchedule(subjects, effectiveCapacity(state.user), state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'LOG_STUDY_DAY': {
      if (!state.user) return state

      const today = todayString()
      const baseline = state.user.comfortableMinutes

      // Prevent duplicate brick placements within the same reset window
      const alreadyPlaced = state.sessions.some((s) => s.date === today && s.completed)
      const actualMinutes = action.actualMinutes
      const isBrick = actualMinutes >= baseline

      if (isBrick && alreadyPlaced) {
        return state
      }

      if (!isBrick) {
        // Less than baseline minutes studied.
        // No brick awarded, no house progress. Save reason in user history.
        const minutesAppliedMap: Record<string, number> = {}
        let remainingMinutes = actualMinutes

        if (remainingMinutes > 0) {
          // Step 1: Apply to today's scheduled lectures first
          for (const item of state.todaySchedule) {
            if (remainingMinutes <= 0) break
            const sub = state.subjects.find((s) => s.id === item.subjectId)
            const lec = sub?.lectures.find((l) => l.id === item.lectureId)
            if (!lec) continue

            const lecRemaining = lec.durationMinutes - lec.watchedMinutes
            if (lecRemaining <= 0) continue

            const minutesToApply = Math.min(remainingMinutes, lecRemaining)
            minutesAppliedMap[lec.id] = (minutesAppliedMap[lec.id] || 0) + minutesToApply
            remainingMinutes -= minutesToApply
          }

          // Step 2: Roll over to any other pending lectures of scheduled subjects if there are still minutes left
          if (remainingMinutes > 0) {
            for (const item of state.todaySchedule) {
              if (remainingMinutes <= 0) break
              const sub = state.subjects.find((s) => s.id === item.subjectId)
              if (!sub) continue

              for (const lec of sub.lectures) {
                if (lec.status === 'completed') continue
                const currentApplied = minutesAppliedMap[lec.id] || 0
                const lecRemaining = lec.durationMinutes - (lec.watchedMinutes + currentApplied)
                if (lecRemaining <= 0) continue

                const minutesToApply = Math.min(remainingMinutes, lecRemaining)
                minutesAppliedMap[lec.id] = currentApplied + minutesToApply
                remainingMinutes -= minutesToApply
                if (remainingMinutes <= 0) break
              }
            }
          }
        }

        const updatedSubjects = state.subjects.map((s) => {
          const hasAppliedMinutes = s.lectures.some((l) => (minutesAppliedMap[l.id] || 0) > 0)
          if (!hasAppliedMinutes) return s

          return {
            ...s,
            lectures: s.lectures.map((l) => {
              const applied = minutesAppliedMap[l.id] || 0
              if (applied <= 0) return l

              const newWatched = l.watchedMinutes + applied
              const isDone = newWatched >= l.durationMinutes
              return {
                ...l,
                watchedMinutes: Math.min(newWatched, l.durationMinutes),
                status: isDone ? ('completed' as const) : l.status,
                completedDate: isDone ? today : l.completedDate,
              }
            }),
          }
        })

        const rhythmResult = adjustCapacityFromStudyTime(
          state.user.currentCapacity,
          state.user.comfortableMinutes,
          actualMinutes,
          state.user.maxRhythm
        )

        const history = state.user.capacityHistory ?? []
        const newHistory = [
          ...history.filter((h) => h.date !== today),
          { date: today, capacity: rhythmResult.newCapacity },
        ].slice(-30)

        const mentorNote = action.reason ? getReasonRecoveryMessage(action.reason) : rhythmResult.note

        const updatedUser: User = {
          ...state.user,
          lastStudyDate: today,
          currentCapacity: rhythmResult.newCapacity,
          capacityHistory: newHistory,
          lastMentorNote: mentorNote ?? state.user.lastMentorNote ?? null,
          totalMinutes: state.user.totalMinutes + actualMinutes,
          totalEffectiveMinutes: state.user.totalEffectiveMinutes ?? state.user.totalMinutes,
        }

        const sessionId = makeId()
        const primaryItem = state.todaySchedule[0] ?? null
        const primarySub = primaryItem ? state.subjects.find((s) => s.id === primaryItem.subjectId) : null
        const primaryLec = primaryItem ? primarySub?.lectures.find((l) => l.id === primaryItem.lectureId) : null

        const newRecord: StudySessionRecord = {
          id: sessionId,
          date: today,
          subjectId: primaryItem?.subjectId ?? '',
          lectureId: primaryItem?.lectureId ?? '',
          subjectName: primarySub?.name ?? '',
          lectureName: primaryLec?.name ?? '',
          plannedMinutes: state.user.currentCapacity,
          actualMinutes,
          completed: false,
          feedback: null,
          missedReason: action.reason,
        }

        const schedule = buildTodaySchedule(
          updatedSubjects,
          effectiveCapacity(updatedUser),
          [...state.sessions, newRecord],
        )

        return {
          ...state,
          user: updatedUser,
          subjects: updatedSubjects,
          sessions: [...state.sessions, newRecord],
          todaySchedule: schedule,
          screen: 'home',
        }
      } else {
        // Baseline or more studied.
        // 1 brick placed. Update subject/lecture watched minutes with rollover logic.
        const minutesAppliedMap: Record<string, number> = {}
        let remainingMinutes = actualMinutes

        // Step 1: Apply to today's scheduled lectures first
        for (const item of state.todaySchedule) {
          if (remainingMinutes <= 0) break
          const sub = state.subjects.find((s) => s.id === item.subjectId)
          const lec = sub?.lectures.find((l) => l.id === item.lectureId)
          if (!lec) continue

          const lecRemaining = lec.durationMinutes - lec.watchedMinutes
          if (lecRemaining <= 0) continue

          const minutesToApply = Math.min(remainingMinutes, lecRemaining)
          minutesAppliedMap[lec.id] = (minutesAppliedMap[lec.id] || 0) + minutesToApply
          remainingMinutes -= minutesToApply
        }

        // Step 2: Roll over to any other pending lectures of scheduled subjects if there are still minutes left
        if (remainingMinutes > 0) {
          for (const item of state.todaySchedule) {
            if (remainingMinutes <= 0) break
            const sub = state.subjects.find((s) => s.id === item.subjectId)
            if (!sub) continue

            for (const lec of sub.lectures) {
              if (lec.status === 'completed') continue
              const currentApplied = minutesAppliedMap[lec.id] || 0
              const lecRemaining = lec.durationMinutes - (lec.watchedMinutes + currentApplied)
              if (lecRemaining <= 0) continue

              const minutesToApply = Math.min(remainingMinutes, lecRemaining)
              minutesAppliedMap[lec.id] = currentApplied + minutesToApply
              remainingMinutes -= minutesToApply
              if (remainingMinutes <= 0) break
            }
          }
        }

        // Step 3: Map subjects and apply minutes
        const updatedSubjects = state.subjects.map((s) => {
          const hasAppliedMinutes = s.lectures.some((l) => (minutesAppliedMap[l.id] || 0) > 0)
          if (!hasAppliedMinutes) return s

          return {
            ...s,
            lectures: s.lectures.map((l) => {
              const applied = minutesAppliedMap[l.id] || 0
              if (applied <= 0) return l

              const newWatched = l.watchedMinutes + applied
              const isDone = newWatched >= l.durationMinutes
              return {
                ...l,
                watchedMinutes: Math.min(newWatched, l.durationMinutes),
                status: isDone ? ('completed' as const) : l.status,
                completedDate: isDone ? today : l.completedDate,
              }
            }),
          }
        })

        // House effort score calculation
        const effortBonus = 1 + Math.min(0.5, actualMinutes / 60)

        // Update house progress floor
        const newSyll = getSyllabusProgress(updatedSubjects)
        const newFraction = newSyll.totalMinutes > 0 ? newSyll.completedMinutes / newSyll.totalMinutes : 0
        const prevFloor = state.user.houseProgressFloor ?? 0
        const nextFloor = Math.max(prevFloor, newFraction)
        const nextFloorTotal = nextFloor > prevFloor
          ? newSyll.totalMinutes
          : state.user.houseFloorTotalMinutes ?? newSyll.totalMinutes

        // Energy honesty history update
        const todayEnergyEntry =
          state.user.todayEnergy && state.user.energyDate === today
            ? [{ date: today, energy: state.user.todayEnergy, completionPct: 1 }]
            : []
        const prevHistory = state.user.energyHistory ?? []
        const nextEnergyHistory = [...prevHistory, ...todayEnergyEntry].slice(-30)

        // Rhythm adjustment
        const rhythmResult = adjustCapacityFromStudyTime(
          state.user.currentCapacity,
          state.user.comfortableMinutes,
          actualMinutes,
          state.user.maxRhythm
        )

        const history = state.user.capacityHistory ?? []
        const newHistory = [
          ...history.filter((h) => h.date !== today),
          { date: today, capacity: rhythmResult.newCapacity },
        ].slice(-30)

        // House stage advancement
        const addedEffectiveMinutes = actualMinutes
        const currentEffective = state.user.totalEffectiveMinutes ?? state.user.totalMinutes
        const projectedEffective = currentEffective + addedEffectiveMinutes

        const prevHouse = getHouseState(
          state.user.totalSessions,
          state.user.houseEffortScore,
          getSyllabusProgress(state.subjects),
          { fraction: prevFloor, totalMinutes: state.user.houseFloorTotalMinutes ?? newSyll.totalMinutes },
          state.user.totalMinutes,
          currentEffective,
          baseline,
        )
        const projectedSessions = state.user.totalSessions + 1
        const nextHouse = getHouseState(
          projectedSessions,
          (state.user.houseEffortScore ?? 0) + effortBonus,
          newSyll,
          { fraction: nextFloor, totalMinutes: nextFloorTotal },
          state.user.totalMinutes + actualMinutes,
          projectedEffective,
          baseline,
        )
        const stageAdvanced =
          !nextHouse.stage.isExpansion && nextHouse.level > prevHouse.level
        const stageMessage = stageAdvanced
          ? getMentorMessage({
              totalSessions: projectedSessions,
              recentFeedback: state.user.recentFeedback ?? [],
              daysSinceLastStudy: 0,
              houseStageKey: nextHouse.stage.key,
              houseStageJustChanged: true,
            })
          : null

        const updatedUser: User = {
          ...state.user,
          lastStudyDate: today,
          totalSessions: projectedSessions,
          totalMinutes: state.user.totalMinutes + actualMinutes,
          totalEffectiveMinutes: projectedEffective,
          houseEffortScore: (state.user.houseEffortScore ?? 0) + effortBonus,
          houseProgressFloor: nextFloor,
          houseFloorTotalMinutes: nextFloorTotal,
          energyHistory: nextEnergyHistory,
          currentCapacity: rhythmResult.newCapacity,
          capacityHistory: newHistory,
          lastMentorNote: stageMessage ?? rhythmResult.note ?? state.user.lastMentorNote ?? null,
        }

        const sessionId = makeId()
        // Record which primary subject/lecture we studied, if any was scheduled
        const primaryItem = state.todaySchedule[0] ?? null
        const primarySub = primaryItem ? state.subjects.find((s) => s.id === primaryItem.subjectId) : null
        const primaryLec = primaryItem ? primarySub?.lectures.find((l) => l.id === primaryItem.lectureId) : null

        const newRecord: StudySessionRecord = {
          id: sessionId,
          date: today,
          subjectId: primaryItem?.subjectId ?? '',
          lectureId: primaryItem?.lectureId ?? '',
          subjectName: primarySub?.name ?? '',
          lectureName: primaryLec?.name ?? '',
          plannedMinutes: state.user.currentCapacity,
          actualMinutes,
          completed: true,
          feedback: null,
        }

        const schedule = buildTodaySchedule(
          updatedSubjects,
          effectiveCapacity(updatedUser),
          [...state.sessions, newRecord],
        )

        return {
          ...state,
          user: updatedUser,
          subjects: updatedSubjects,
          sessions: [...state.sessions, newRecord],
          todaySchedule: schedule,
          screen: 'home',
        }
      }
    }

    case 'SET_ENERGY': {
      if (!state.user) return state
      const updatedUser: User = {
        ...state.user,
        todayEnergy: action.energy,
        energyDate: todayString(),
      }
      const schedule = buildTodaySchedule(
        state.subjects,
        effectiveCapacity(updatedUser),
        state.sessions,
      )
      return { ...state, user: updatedUser, todaySchedule: schedule }
    }

    case 'EXIT_RECOVERY': {
      if (!state.user) return state
      const newComfortable = Math.max(5, action.comfortableMinutes)
      const updatedUser: User = {
        ...state.user,
        comfortableMinutes: newComfortable,
        currentCapacity: newComfortable,
        recoveryMode: false,
        progressionPaused: false,
        recentFeedback: [],
        confidenceScore: 0,
        lastMentorNote: "A fresh foundation. We rebuild gently.",
      }
      const schedule = buildTodaySchedule(
        state.subjects,
        effectiveCapacity(updatedUser),
        state.sessions,
      )
      return { ...state, user: updatedUser, todaySchedule: schedule, screen: 'home' }
    }

    case 'UPDATE_USER':
      if (!state.user) return state
      return { ...state, user: { ...state.user, ...action.updates } }

    case 'UPDATE_AVATAR':
      if (!state.user) return state
      return { ...state, user: { ...state.user, avatarUrl: action.avatarUrl } }

    case 'RESET_APP':
      return { ...initialState }

    case 'HYDRATE':
      return { ...state, ...action.state }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
} | null>(null)

const STORAGE_KEY = 'brick_v1'
const LEGACY_STORAGE_KEY = 'studycoach_v2'
const APP_VERSION = '2026.06.17'
const APP_VERSION_KEY = 'brick_app_version'

export function getAppVersion(): string {
  return APP_VERSION
}

export function acknowledgeAppVersion(): void {
  try { localStorage.setItem(APP_VERSION_KEY, APP_VERSION) } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AppState
        if (parsed.user?.onboardingComplete) {
          // Backfill missing fields for users from older versions
          if (!parsed.user.recentFeedback) parsed.user.recentFeedback = []
          if (parsed.user.confidenceScore === undefined) parsed.user.confidenceScore = 0
          if (parsed.user.avatarUrl === undefined) parsed.user.avatarUrl = null
          if (!parsed.user.capacityHistory) parsed.user.capacityHistory = []
          if (parsed.user.progressionPaused === undefined) parsed.user.progressionPaused = false
          if (parsed.user.lastMentorNote === undefined) parsed.user.lastMentorNote = null
          if (parsed.user.maxRhythm === undefined) parsed.user.maxRhythm = 120
          if (parsed.user.todayEnergy === undefined) parsed.user.todayEnergy = null
          if (parsed.user.energyDate === undefined) parsed.user.energyDate = null
          if (parsed.user.recoveryMode === undefined) parsed.user.recoveryMode = false
          if (parsed.user.totalMinutes === undefined) {
            parsed.user.totalMinutes = (parsed.sessions ?? []).reduce((acc, s) => acc + s.actualMinutes, 0)
          }
          if (parsed.user.totalSessions === undefined) {
            parsed.user.totalSessions = (parsed.sessions ?? []).filter(s => s.completed).length
          }
          if (parsed.user.totalEffectiveMinutes === undefined) {
            parsed.user.totalEffectiveMinutes = parsed.user.totalMinutes
          }
          if (parsed.user.houseEffortScore === undefined) {
            parsed.user.houseEffortScore = computeEffortScore(parsed.sessions ?? [])
          }
          if (parsed.user.energyHistory === undefined) parsed.user.energyHistory = []
          if (parsed.user.houseProgressFloor === undefined) {
            // Initialise the floor at the current syllabus completion so historic
            // progress is preserved going forward.
            const syll = getSyllabusProgress(parsed.subjects ?? [])
            parsed.user.houseProgressFloor =
              syll.totalMinutes > 0 ? syll.completedMinutes / syll.totalMinutes : 0
            parsed.user.houseFloorTotalMinutes = syll.totalMinutes
          }

          // ─── One-time correction: 15 June 2026 manual credit ─────────────
          // Before the timer-background fix, the app auto-paused when the
          // phone locked, under-recording a session the student genuinely
          // completed in real life. This block credits that day exactly once.
          const JUNE_15 = '2026-06-15'
          const alreadyCreditedJune15 =
            parsed.user.june15CreditApplied === true ||
            (parsed.sessions ?? []).some(
              (s) => s.date === JUNE_15 && s.completed,
            )
          if (!alreadyCreditedJune15) {
            const activeSub = (parsed.subjects ?? []).find(
              (s) => !s.archived && s.lectures.some((l) => l.status !== 'completed'),
            )
            const targetLec = activeSub?.lectures.find(
              (l) => l.status !== 'completed',
            )
            if (activeSub && targetLec) {
              const creditMinutes = Math.max(
                5,
                Math.min(
                  parsed.user.currentCapacity,
                  targetLec.durationMinutes - targetLec.watchedMinutes,
                ),
              )
              // Mark lecture watched (do not over-complete other lectures).
              const newWatched = Math.min(
                targetLec.durationMinutes,
                targetLec.watchedMinutes + creditMinutes,
              )
              const lecDone = newWatched >= targetLec.durationMinutes
              parsed.subjects = (parsed.subjects ?? []).map((s) =>
                s.id !== activeSub.id
                  ? s
                  : {
                      ...s,
                      lectures: s.lectures.map((l) =>
                        l.id !== targetLec.id
                          ? l
                          : {
                              ...l,
                              watchedMinutes: newWatched,
                              status: lecDone ? 'completed' : 'pending',
                              completedDate: lecDone ? JUNE_15 : l.completedDate,
                            },
                      ),
                    },
              )
              // Synthetic session record (one brick).
              const correctionSession: StudySessionRecord = {
                id: 'correction-2026-06-15',
                date: JUNE_15,
                subjectId: activeSub.id,
                lectureId: targetLec.id,
                subjectName: activeSub.name,
                lectureName: targetLec.name,
                plannedMinutes: creditMinutes,
                actualMinutes: creditMinutes,
                completed: true,
                feedback: null,
              }
              parsed.sessions = [...(parsed.sessions ?? []), correctionSession]
              // Counters + house progression floor.
              const effortBonus = 1 + Math.min(0.5, creditMinutes / 60)
              const syll = getSyllabusProgress(parsed.subjects)
              const newFraction =
                syll.totalMinutes > 0
                  ? syll.completedMinutes / syll.totalMinutes
                  : 0
              const prevFloor = parsed.user.houseProgressFloor ?? 0
              const nextFloor = Math.max(prevFloor, newFraction)
              parsed.user = {
                ...parsed.user,
                totalSessions: (parsed.user.totalSessions ?? 0) + 1,
                totalMinutes: (parsed.user.totalMinutes ?? 0) + creditMinutes,
                houseEffortScore:
                  (parsed.user.houseEffortScore ?? 0) + effortBonus,
                houseProgressFloor: nextFloor,
                houseFloorTotalMinutes:
                  nextFloor > prevFloor
                    ? syll.totalMinutes
                    : parsed.user.houseFloorTotalMinutes ?? syll.totalMinutes,
                lastStudyDate:
                  !parsed.user.lastStudyDate ||
                  parsed.user.lastStudyDate < JUNE_15
                    ? JUNE_15
                    : parsed.user.lastStudyDate,
                june15CreditApplied: true,
              }
            } else {
              // No eligible lecture (e.g. syllabus already complete) — still
              // mark the flag so we don't keep retrying every refresh.
              parsed.user = { ...parsed.user, june15CreditApplied: true }
            }
          }


          // Missed-day recovery — Brick eases the workload, never punishes.
          // Idempotent per day: a second refresh on the same day must NOT
          // shrink the rhythm again. We stamp `lastRecoveryAppliedDate` and
          // skip if it already matches today.
          const today = todayString()
          const away = daysAway(parsed.user.lastStudyDate)
          let startScreen: Screen = 'home'
          const alreadyAppliedToday =
            parsed.user.lastRecoveryAppliedDate === today
          if (away >= 1 && !alreadyAppliedToday) {
            const rec = applyMissedDayRecovery(
              parsed.user.currentCapacity,
              parsed.user.comfortableMinutes,
              away,
            )
            parsed.user.currentCapacity = rec.newCapacity
            parsed.user.recoveryMode = rec.recoveryMode
            parsed.user.lastRecoveryAppliedDate = today
            if (rec.mentorNote) parsed.user.lastMentorNote = rec.mentorNote
            if (rec.needsRecoveryOnboarding) {
              startScreen = 'recovery'
            } else if (isLongGap(parsed.user.lastStudyDate)) {
              startScreen = 'welcome-back'
            }
          } else if (away >= 1 && alreadyAppliedToday && isLongGap(parsed.user.lastStudyDate)) {
            // Still surface the welcome-back screen on same-day refresh,
            // but don't re-apply the capacity reduction.
            startScreen = 'welcome-back'
          }


          // Clear stale energy from a previous day
          if (parsed.user.energyDate && parsed.user.energyDate !== todayString()) {
            parsed.user.todayEnergy = null
            parsed.user.energyDate = null
          }

          let restoredScreen: Screen = startScreen

          // If we just credited 15 June and today is 15 June, the day's
          // brick is already placed — show an empty schedule so the home
          // screen surfaces "All done for today" instead of re-prompting.
          const justCreditedToday =
            !alreadyCreditedJune15 &&
            parsed.user.june15CreditApplied === true &&
            todayString() === JUNE_15
          const schedule = justCreditedToday
            ? []
            : buildTodaySchedule(
                parsed.subjects ?? [],
                effectiveCapacity(parsed.user),
                parsed.sessions ?? [],
              )
          // App-update gate: if the stored app version differs from the
          // current build, surface the Update screen first so the user can
          // restore from a local backup before continuing.
          let finalScreen: Screen = restoredScreen
          try {
            const stored = localStorage.getItem(APP_VERSION_KEY)
            if (stored !== APP_VERSION) {
              finalScreen = 'update'
            }
          } catch {}

          dispatch({
            type: 'HYDRATE',
            state: {
              ...parsed,
              todaySchedule: schedule,
              screen: finalScreen,
            },
          })
        } else {
          dispatch({ type: 'HYDRATE', state: parsed })
          // Non-onboarded user: nothing to protect, accept current version.
          try { localStorage.setItem(APP_VERSION_KEY, APP_VERSION) } catch {}
        }

      } else {
        // Fresh install — no data to migrate, accept current version.
        try { localStorage.setItem(APP_VERSION_KEY, APP_VERSION) } catch {}
      }
    } catch (e) {
      console.error('[Brick] Hydration error:', e)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    startReminderScheduler()
    return () => stopReminderScheduler()
  }, [])



  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('[Brick] Persist error:', e)
    }
  }, [state, hydrated])


  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ─── Backup / Restore ────────────────────────────────────────────────────────
// Brick is local-first. These helpers let the student safely export and
// re-import their full study record so a cleared browser never wipes years
// of work.

export function exportBackup(): string {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
  const payload = {
    app: 'brick',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(raw),
  }
  return JSON.stringify(payload, null, 2)
}

export function importBackup(json: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json)
    const data = parsed?.data ?? parsed
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Backup file is not in a recognised format.' }
    }

    if (!data.user || typeof data.user !== 'object' || Array.isArray(data.user)) {
      return { ok: false, error: 'Backup is missing valid user data.' }
    }
    if (!Array.isArray(data.subjects)) {
      return { ok: false, error: 'Backup is missing valid subjects array.' }
    }
    if (data.sessions !== undefined && !Array.isArray(data.sessions)) {
      return { ok: false, error: 'Backup contains invalid sessions data.' }
    }

    // Safety requirement: Create emergency backup of current state
    const currentStored = localStorage.getItem(STORAGE_KEY)
    if (currentStored) {
      try {
        createEmergencyBackup(JSON.parse(currentStored))
      } catch (e) {
        console.error('Failed to create emergency backup before restore:', e)
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Could not parse the backup file.' }
  }
}

export function getSubjectById(subjects: Subject[], id: string): Subject | undefined {
  return subjects.find((s) => s.id === id)
}

export function getLectureById(
  subjects: Subject[],
  subjectId: string,
  lectureId: string
) {
  return subjects.find((s) => s.id === subjectId)?.lectures.find((l) => l.id === lectureId)
}

export function makeSampleSubjects(): Subject[] {
  const colors: SubjectColor[] = ['lavender', 'sage', 'amber']
  const icons: SubjectIcon[] = ['calculator', 'book', 'globe']
  const data = [
    {
      name: 'Maths',
      lectures: [
        { name: 'Lecture 1', dur: 45 },
        { name: 'Lecture 2', dur: 52 },
        { name: 'Lecture 3', dur: 38 },
      ],
    },
    {
      name: 'Reasoning',
      lectures: [
        { name: 'Lecture 1', dur: 42 },
        { name: 'Lecture 2', dur: 35 },
      ],
    },
    {
      name: 'English',
      lectures: [
        { name: 'Lecture 1', dur: 35 },
        { name: 'Lecture 2', dur: 28 },
      ],
    },
  ]
  return data.map((s, i) => ({
    id: makeId(),
    name: s.name,
    color: colors[i % colors.length],
    icon: icons[i % icons.length],
    lectures: s.lectures.map((l) => ({
      id: makeId(),
      name: l.name,
      durationMinutes: l.dur,
      status: 'pending' as const,
      watchedMinutes: 0,
    })),
  }))
}
