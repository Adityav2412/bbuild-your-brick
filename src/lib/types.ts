export type Screen =
  | 'welcome'
  | 'onboarding'
  | 'home'
  | 'plan'
  | 'session'
  | 'progress'
  | 'settings'
  | 'recovery'
  | 'welcome-back'
  | 'import'

export type SessionFeedback = 'easy' | 'comfortable' | 'difficult' | 'couldnt-finish'

export interface User {
  name: string
  examName: string
  examDate: string
  /** Starting capacity the user reported in onboarding */
  comfortableMinutes: number
  /** Current daily target set by the psychology engine */
  currentCapacity: number
  lastStudyDate: string | null
  onboardingComplete: boolean
  totalSessions: number
  totalMinutes: number
  joinDate: string
  /** Optional avatar image data URL or URL */
  avatarUrl: string | null
  /** Psychology engine: rolling feedback counts for capacity adjustment */
  recentFeedback: SessionFeedback[]
}

export interface Lecture {
  id: string
  name: string
  durationMinutes: number
  status: 'pending' | 'completed'
  completedDate?: string
  watchedMinutes: number
}

export type SubjectColor = 'lavender' | 'sage' | 'amber' | 'sky' | 'rose' | 'emerald'
export type SubjectIcon = 'atom' | 'flask' | 'calculator' | 'globe' | 'book' | 'microscope' | 'landmark' | 'code'

export interface Subject {
  id: string
  name: string
  color: SubjectColor
  icon: SubjectIcon
  lectures: Lecture[]
}

export interface StudySessionRecord {
  id: string
  date: string
  subjectId: string
  lectureId: string
  subjectName: string
  lectureName: string
  plannedMinutes: number
  actualMinutes: number
  completed: boolean
  feedback: SessionFeedback | null
}

export interface TodayScheduleItem {
  subjectId: string
  lectureId: string
  targetMinutes: number
  watchedFrom: number
  status: 'in-progress' | 'upcoming' | 'completed'
}

export interface ActiveSession {
  subjectId: string
  lectureId: string
  targetMinutes: number
  startTime: number
  pausedAt: number | null
  totalPausedMs: number
}
