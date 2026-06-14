'use client'

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react'
import type {
  Screen,
  User,
  Subject,
  StudySessionRecord,
  TodayScheduleItem,
  ActiveSession,
  SubjectColor,
  SubjectIcon,
  SessionFeedback,
} from './types'
import {
  buildTodaySchedule,
  applyFeedbackToCapacity,
  isLongGap,
  SUBJECT_COLORS,
  SUBJECT_ICONS,
} from './algorithm'

// ─── State ────────────────────────────────────────────────────────────────────

export interface AppState {
  screen: Screen
  previousScreen: Screen | null
  user: User | null
  subjects: Subject[]
  sessions: StudySessionRecord[]
  todaySchedule: TodayScheduleItem[]
  activeSession: ActiveSession | null
  /** Session just completed, awaiting feedback */
  pendingFeedback: { sessionId: string } | null
  onboardingStep: number
  draft: {
    name: string
    examName: string
    examDate: string
    comfortableMinutes: number
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
  | { type: 'START_SESSION'; subjectId: string; lectureId: string; targetMinutes: number }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'END_SESSION'; actualSeconds: number; completed: boolean }
  | { type: 'SKIP_SESSION' }
  | { type: 'SUBMIT_FEEDBACK'; sessionId: string; feedback: SessionFeedback }
  | { type: 'UPDATE_USER'; updates: Partial<User> }
  | { type: 'UPDATE_AVATAR'; avatarUrl: string | null }
  | { type: 'RESET_APP' }
  | { type: 'HYDRATE'; state: Partial<AppState> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AppState = {
  screen: 'welcome',
  previousScreen: null,
  user: null,
  subjects: [],
  sessions: [],
  todaySchedule: [],
  activeSession: null,
  pendingFeedback: null,
  onboardingStep: 0,
  draft: {
    name: '',
    examName: '',
    examDate: '',
    comfortableMinutes: 20,
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
        lastStudyDate: null,
        onboardingComplete: true,
        totalSessions: 0,
        totalMinutes: 0,
        joinDate: todayString(),
        avatarUrl: null,
        recentFeedback: [],
      }
      const schedule = buildTodaySchedule(action.subjects, user.currentCapacity, state.sessions)
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
        ? buildTodaySchedule(merged, state.user.currentCapacity, state.sessions)
        : state.todaySchedule
      return { ...state, subjects: merged, todaySchedule: schedule }
    }

    case 'UPDATE_SUBJECT': {
      const subjects = state.subjects.map((s) =>
        s.id === action.subject.id ? action.subject : s
      )
      const schedule = state.user
        ? buildTodaySchedule(subjects, state.user.currentCapacity, state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'DELETE_SUBJECT': {
      const subjects = state.subjects.filter((s) => s.id !== action.subjectId)
      const schedule = state.user
        ? buildTodaySchedule(subjects, state.user.currentCapacity, state.sessions)
        : state.todaySchedule
      return { ...state, subjects, todaySchedule: schedule }
    }

    case 'START_SESSION':
      return {
        ...state,
        activeSession: {
          subjectId: action.subjectId,
          lectureId: action.lectureId,
          targetMinutes: action.targetMinutes,
          startTime: Date.now(),
          pausedAt: null,
          totalPausedMs: 0,
        },
        previousScreen: state.screen,
        screen: 'session',
      }

    case 'PAUSE_SESSION':
      if (!state.activeSession || state.activeSession.pausedAt !== null) return state
      return {
        ...state,
        activeSession: { ...state.activeSession, pausedAt: Date.now() },
      }

    case 'RESUME_SESSION': {
      if (!state.activeSession || state.activeSession.pausedAt === null) return state
      const paused = Date.now() - state.activeSession.pausedAt
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          pausedAt: null,
          totalPausedMs: state.activeSession.totalPausedMs + paused,
        },
      }
    }

    case 'END_SESSION': {
      if (!state.activeSession || !state.user) {
        return { ...state, activeSession: null, screen: 'home' }
      }
      const { subjectId, lectureId, targetMinutes } = state.activeSession
      const actualMinutes = Math.round(action.actualSeconds / 60)

      const sub = state.subjects.find((s) => s.id === subjectId)
      const lec = sub?.lectures.find((l) => l.id === lectureId)

      const updatedSubjects = state.subjects.map((s) => {
        if (s.id !== subjectId) return s
        return {
          ...s,
          lectures: s.lectures.map((l) => {
            if (l.id !== lectureId) return l
            const newWatched = l.watchedMinutes + actualMinutes
            const isDone = action.completed || newWatched >= l.durationMinutes
            return {
              ...l,
              watchedMinutes: Math.min(newWatched, l.durationMinutes),
              status: isDone ? ('completed' as const) : ('pending' as const),
              completedDate: isDone ? todayString() : undefined,
            }
          }),
        }
      })

      const today = todayString()
      const updatedUser: User = {
        ...state.user,
        lastStudyDate: today,
        totalSessions: state.user.totalSessions + 1,
        totalMinutes: state.user.totalMinutes + actualMinutes,
      }

      const sessionId = makeId()
      const newRecord: StudySessionRecord = {
        id: sessionId,
        date: today,
        subjectId,
        lectureId,
        subjectName: sub?.name ?? '',
        lectureName: lec?.name ?? '',
        plannedMinutes: targetMinutes,
        actualMinutes,
        completed: action.completed,
        feedback: null,
      }

      const schedule = buildTodaySchedule(updatedSubjects, updatedUser.currentCapacity, state.sessions)

      return {
        ...state,
        activeSession: null,
        user: updatedUser,
        subjects: updatedSubjects,
        sessions: [...state.sessions, newRecord],
        todaySchedule: schedule,
        pendingFeedback: { sessionId },
        screen: 'home',
      }
    }

    case 'SKIP_SESSION':
      return { ...state, activeSession: null, screen: 'home' }

    case 'SUBMIT_FEEDBACK': {
      if (!state.user) return { ...state, pendingFeedback: null }

      // Find capacity from ~7 days ago for the 10%/week growth cap
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const history = state.user.capacityHistory ?? []
      const past = [...history]
        .filter((h) => new Date(h.date).getTime() <= sevenDaysAgo.getTime())
        .pop()
      const capacity7DaysAgo = past?.capacity ?? state.user.comfortableMinutes

      const result = applyFeedbackToCapacity(
        state.user.currentCapacity,
        state.user.comfortableMinutes,
        state.user.recentFeedback,
        action.feedback,
        capacity7DaysAgo,
      )

      const today = todayString()
      const newHistory = [
        ...history.filter((h) => h.date !== today),
        { date: today, capacity: result.newCapacity },
      ].slice(-30)

      const updatedUser: User = {
        ...state.user,
        currentCapacity: result.newCapacity,
        recentFeedback: result.updatedFeedback,
        capacityHistory: newHistory,
        progressionPaused: result.progressionPaused,
        lastMentorNote: result.note,
      }
      const updatedSessions = state.sessions.map((s) =>
        s.id === action.sessionId ? { ...s, feedback: action.feedback } : s
      )
      const schedule = buildTodaySchedule(state.subjects, result.newCapacity, updatedSessions)
      return {
        ...state,
        user: updatedUser,
        sessions: updatedSessions,
        todaySchedule: schedule,
        pendingFeedback: null,
      }
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

const STORAGE_KEY = 'studycoach_v2'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AppState
        if (parsed.user?.onboardingComplete) {
          // Backfill missing fields for existing users upgrading from v1
          if (!parsed.user.recentFeedback) {
            parsed.user.recentFeedback = []
          }
          if (parsed.user.avatarUrl === undefined) {
            parsed.user.avatarUrl = null
          }
          const schedule = buildTodaySchedule(
            parsed.subjects ?? [],
            parsed.user.currentCapacity
          )
          const longGap = isLongGap(parsed.user.lastStudyDate)
          dispatch({
            type: 'HYDRATE',
            state: {
              ...parsed,
              todaySchedule: schedule,
              activeSession: null,
              pendingFeedback: null,
              screen: longGap ? 'welcome-back' : 'home',
            },
          })
        } else {
          dispatch({ type: 'HYDRATE', state: { ...parsed, activeSession: null } })
        }
      }
    } catch (e) {
      console.error('[StudyCoach] Hydration error:', e)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      const toStore: AppState = { ...state, activeSession: null }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    } catch (e) {
      console.error('[StudyCoach] Persist error:', e)
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

// ─── Selectors ────────────────────────────────────────────────────────────────

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
  const colors: SubjectColor[] = ['lavender', 'rose', 'amber', 'sky']
  const icons: SubjectIcon[] = ['atom', 'flask', 'calculator', 'globe']
  const data = [
    {
      name: 'Physics',
      lectures: [
        { name: 'Lecture 1 – Kinematics', dur: 45 },
        { name: 'Lecture 2 – Newton\'s Laws', dur: 38 },
        { name: 'Lecture 3 – Work & Energy', dur: 42 },
      ],
    },
    {
      name: 'Chemistry',
      lectures: [
        { name: 'Lecture 1 – Atomic Structure', dur: 52 },
        { name: 'Lecture 2 – Periodic Table', dur: 35 },
        { name: 'Lecture 3 – Chemical Bonding', dur: 48 },
      ],
    },
    {
      name: 'Mathematics',
      lectures: [
        { name: 'Lecture 1 – Limits', dur: 40 },
        { name: 'Lecture 2 – Derivatives', dur: 45 },
        { name: 'Lecture 3 – Integrals', dur: 55 },
      ],
    },
    {
      name: 'English',
      lectures: [
        { name: 'Lecture 1 – Essay Writing', dur: 30 },
        { name: 'Lecture 2 – Reading Comprehension', dur: 25 },
      ],
    },
  ]

  return data.map((s, i) => ({
    id: makeId(),
    name: s.name,
    color: colors[i] as SubjectColor,
    icon: icons[i] as SubjectIcon,
    lectures: s.lectures.map((l) => ({
      id: makeId(),
      name: l.name,
      durationMinutes: l.dur,
      status: 'pending' as const,
      watchedMinutes: 0,
    })),
  }))
}
