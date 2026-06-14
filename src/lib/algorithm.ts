import type {
  Subject,
  TodayScheduleItem,
  User,
  SessionFeedback,
  StudySessionRecord,
} from './types'

// ─── Psychology Capacity Engine ──────────────────────────────────────────────
// Brick is a mentor, not a tracker. Capacity moves gently, never aggressively.
//
// Rules:
//   3 Easy sessions in the last window         → +5 min
//   3 Comfortable sessions in the last window  → +2 min
//   Difficult                                  → hold
//   2 Difficult sessions in a row              → pause progression (hold + cooldown flag)
//   Could not finish                           → −3 min (gentle reduction)
//
// Hard cap: never grow more than 10% above the user's capacity from 7 days ago.
// Floor: never drop below 50% of the user's reported comfortable starting capacity.

export interface CapacityResult {
  newCapacity: number
  updatedFeedback: SessionFeedback[]
  /** True if the engine intentionally paused growth (cooldown after 2 difficult) */
  progressionPaused: boolean
  /** Optional short note the mentor can surface to the user */
  note: string | null
}

export function applyFeedbackToCapacity(
  currentCapacity: number,
  comfortableMinutes: number,
  recentFeedback: SessionFeedback[],
  newFeedback: SessionFeedback,
  capacity7DaysAgo: number | null = null,
): CapacityResult {
  const updated = [...recentFeedback, newFeedback].slice(-8)
  const last2 = updated.slice(-2)
  const last3 = updated.slice(-3)

  const floor = Math.max(10, Math.round(comfortableMinutes * 0.5))
  const baseFor10pct = capacity7DaysAgo ?? comfortableMinutes
  const weeklyCeiling = Math.round(baseFor10pct * 1.1)

  let newCapacity = currentCapacity
  let paused = false
  let note: string | null = null

  // 2 difficult in a row → pause progression (hold and cool down)
  if (last2.length === 2 && last2.every((f) => f === 'difficult')) {
    paused = true
    note = "Holding steady. Let's give today the same shape as yesterday."
    return { newCapacity: currentCapacity, updatedFeedback: updated, progressionPaused: true, note }
  }

  if (newFeedback === 'couldnt-finish') {
    newCapacity = Math.max(floor, currentCapacity - 3)
    note = 'Easing things down a touch. Tomorrow we begin again.'
  } else if (newFeedback === 'difficult') {
    newCapacity = currentCapacity // hold
  } else if (last3.length === 3 && last3.every((f) => f === 'easy')) {
    const target = Math.min(weeklyCeiling, currentCapacity + 5)
    if (target > currentCapacity) note = 'Your rhythm grew by a few minutes. Quietly.'
    newCapacity = target
  } else if (last3.length === 3 && last3.every((f) => f === 'comfortable')) {
    const target = Math.min(weeklyCeiling, currentCapacity + 2)
    if (target > currentCapacity) note = 'A small, sustainable step in your rhythm.'
    newCapacity = target
  }

  // Enforce weekly 10% cap defensively
  if (newCapacity > weeklyCeiling) newCapacity = weeklyCeiling

  return { newCapacity, updatedFeedback: updated, progressionPaused: false, note }
}

// ─── Smart Subject Rotation ──────────────────────────────────────────────────
// Brick decides what to study so the student doesn't have to.
// We rank subjects by:
//   1. Recency  — subjects not studied recently rise to the top
//   2. Balance  — subjects with more remaining lectures vs. studied get priority
//   3. Tie-break by original order
// Then we fill today's capacity by walking the ranked list.

function rankSubjects(subjects: Subject[], sessions: StudySessionRecord[]): Subject[] {
  const today = Date.now()
  const lastTouched = new Map<string, number>()
  const recentCount = new Map<string, number>()

  // Look at last 14 days of sessions
  for (const s of sessions) {
    const t = new Date(s.date).getTime()
    if (today - t > 14 * 86400000) continue
    lastTouched.set(s.subjectId, Math.max(lastTouched.get(s.subjectId) ?? 0, t))
    recentCount.set(s.subjectId, (recentCount.get(s.subjectId) ?? 0) + 1)
  }

  const withPending = subjects.filter((s) =>
    s.lectures.some((l) => l.status === 'pending'),
  )

  return [...withPending].sort((a, b) => {
    // Subjects never touched come first
    const aTouched = lastTouched.get(a.id) ?? 0
    const bTouched = lastTouched.get(b.id) ?? 0
    if (aTouched !== bTouched) return aTouched - bTouched // older/zero first

    // Then those with fewer recent sessions
    const aRecent = recentCount.get(a.id) ?? 0
    const bRecent = recentCount.get(b.id) ?? 0
    if (aRecent !== bRecent) return aRecent - bRecent

    // Then those with more pending work remaining
    const aPending = a.lectures.filter((l) => l.status === 'pending').length
    const bPending = b.lectures.filter((l) => l.status === 'pending').length
    return bPending - aPending
  })
}

// ─── Schedule Builder ─────────────────────────────────────────────────────────

/** Builds today's assignment by picking the next pending lecture across subjects, smartly rotated. */
export function buildTodaySchedule(
  subjects: Subject[],
  capacityMinutes: number,
  sessions: StudySessionRecord[] = [],
): TodayScheduleItem[] {
  const schedule: TodayScheduleItem[] = []
  let remaining = capacityMinutes
  let isFirst = true

  const ranked = rankSubjects(subjects, sessions)

  for (const subject of ranked) {
    if (remaining <= 0) break

    const pendingLecture = subject.lectures.find((l) => l.status === 'pending')
    if (!pendingLecture) continue

    const alreadyWatched = pendingLecture.watchedMinutes
    const lectureRemaining = pendingLecture.durationMinutes - alreadyWatched
    const watchTarget = Math.min(lectureRemaining, remaining)

    if (watchTarget <= 0) continue

    schedule.push({
      subjectId: subject.id,
      lectureId: pendingLecture.id,
      targetMinutes: watchTarget,
      watchedFrom: alreadyWatched,
      status: isFirst ? 'in-progress' : 'upcoming',
    })

    remaining -= watchTarget
    isFirst = false
  }

  return schedule
}

// ─── Mentor Messages ──────────────────────────────────────────────────────────

const MENTOR_MESSAGES = [
  'Focus on today\u2019s brick.',
  'Small steps build strong foundations.',
  'Today\u2019s effort matters.',
  'One session at a time.',
  'Consistency grows quietly.',
  'You don\u2019t need to plan. Just begin.',
  'Show up. Place the brick. That\u2019s the whole job.',
  'A home is built one brick at a time.',
  'Progress is patient. So are you.',
  'The work you do today settles into your foundation.',
]

export function getMentorMessage(totalSessions: number): string {
  return MENTOR_MESSAGES[totalSessions % MENTOR_MESSAGES.length]
}

// ─── House of Knowledge ───────────────────────────────────────────────────────
// Every completed session places one brick.
// The user slowly builds a beautiful home.
//
// Stages:
//   0 Foundation → 1 Walls → 2 Windows → 3 Door → 4 Roof → 5 Garden → 6 Completed Home
// Stage thresholds (in bricks/sessions): 0, 4, 12, 22, 34, 48, 64

export interface HouseStage {
  index: 0 | 1 | 2 | 3 | 4 | 5 | 6
  key: 'foundation' | 'walls' | 'windows' | 'door' | 'roof' | 'garden' | 'complete'
  label: string
  description: string
  bricksRequired: number
}

export const HOUSE_STAGES: HouseStage[] = [
  { index: 0, key: 'foundation', label: 'Foundation',     description: 'The ground is set. Every home begins here.',   bricksRequired: 0 },
  { index: 1, key: 'walls',      label: 'Walls',          description: 'The walls rise, brick by brick.',                bricksRequired: 4 },
  { index: 2, key: 'windows',    label: 'Windows',        description: 'Light begins to enter the home.',                bricksRequired: 12 },
  { index: 3, key: 'door',       label: 'Door',           description: 'A way in. The home becomes yours.',              bricksRequired: 22 },
  { index: 4, key: 'roof',       label: 'Roof',           description: 'Shelter. Quiet protection overhead.',            bricksRequired: 34 },
  { index: 5, key: 'garden',     label: 'Garden',         description: 'Life grows around the home you built.',          bricksRequired: 48 },
  { index: 6, key: 'complete',   label: 'Completed Home', description: 'Built slowly. Built well. Built by you.',        bricksRequired: 64 },
]

export interface HouseState {
  /** Total bricks placed (== total completed sessions) */
  bricks: number
  /** Current stage 0..6 */
  level: number
  /** Current stage object */
  stage: HouseStage
  /** Next stage (null if at the end) */
  nextStage: HouseStage | null
  /** Bricks needed to reach the next visible upgrade */
  bricksToNext: number
  /** Fraction within current stage (0..1) */
  stageFraction: number
  /** Overall fraction across all stages (0..1) */
  fraction: number
  /** Short note about what was just placed (for celebration moments) */
  recentRestoration: string | null
  /** Human description of the current stage */
  description: string
}

export function getHouseState(totalSessions: number): HouseState {
  const bricks = Math.max(0, totalSessions)
  let level = 0
  for (let i = HOUSE_STAGES.length - 1; i >= 0; i--) {
    if (bricks >= HOUSE_STAGES[i].bricksRequired) {
      level = i
      break
    }
  }
  const stage = HOUSE_STAGES[level]
  const nextStage = HOUSE_STAGES[level + 1] ?? null
  const bricksToNext = nextStage ? Math.max(0, nextStage.bricksRequired - bricks) : 0
  const stageSpan = nextStage ? nextStage.bricksRequired - stage.bricksRequired : 1
  const within = nextStage ? bricks - stage.bricksRequired : stageSpan
  const stageFraction = stageSpan > 0 ? Math.min(1, within / stageSpan) : 1
  const totalBricksForFull = HOUSE_STAGES[HOUSE_STAGES.length - 1].bricksRequired
  const fraction = Math.min(1, bricks / totalBricksForFull)

  return {
    bricks,
    level,
    stage,
    nextStage,
    bricksToNext,
    stageFraction,
    fraction,
    recentRestoration: bricks > 0 ? `+1 brick placed` : null,
    description: stage.description,
  }
}

// Back-compat alias for screens that still import the old name.
export const getObservatoryState = (totalSessions: number) => {
  const h = getHouseState(totalSessions)
  return {
    level: h.level,
    description: h.description,
    recentRestoration: h.recentRestoration,
    fraction: h.fraction,
    stage: h.stage,
    nextStage: h.nextStage,
    bricksToNext: h.bricksToNext,
    bricks: h.bricks,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function getWeekDays(): { day: string; date: number; isToday: boolean; offset: number }[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()
  return [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    return { day: days[d.getDay()], date: d.getDate(), isToday: offset === 0, offset }
  })
}

export function parseSubjectText(text: string): {
  name: string
  lectures: { name: string; durationMinutes: number }[]
}[] {
  const results: { name: string; lectures: { name: string; durationMinutes: number }[] }[] = []
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  let currentSubject: { name: string; lectures: { name: string; durationMinutes: number }[] } | null = null

  for (const line of lines) {
    const lectureMatch = line.match(/^(.+?)\s*[-–—]\s*(\d+)\s*min/i)
    if (lectureMatch && currentSubject) {
      currentSubject.lectures.push({
        name: lectureMatch[1].trim(),
        durationMinutes: parseInt(lectureMatch[2], 10),
      })
    } else if (!lectureMatch) {
      currentSubject = { name: line, lectures: [] }
      results.push(currentSubject)
    }
  }
  return results.filter((s) => s.lectures.length > 0)
}

/** A user is "away" if last study was 3+ days ago. Used for the gentle welcome-back screen. */
export function isLongGap(lastStudyDate: string | null): boolean {
  if (!lastStudyDate) return false
  const last = new Date(lastStudyDate)
  const today = new Date()
  const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= 3
}

/** Days away since last study (0 if same day). */
export function daysAway(lastStudyDate: string | null): number {
  if (!lastStudyDate) return 0
  const last = new Date(lastStudyDate)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86400000))
}

/** After several days away, Brick eases the workload — never penalises. */
export function easedCapacityAfterGap(
  currentCapacity: number,
  comfortableMinutes: number,
  daysAwayCount: number,
): number {
  if (daysAwayCount < 3) return currentCapacity
  // Reduce by ~20% for a 3+ day gap, ~35% for a 7+ day gap. Never below floor.
  const factor = daysAwayCount >= 7 ? 0.65 : 0.8
  const floor = Math.max(10, Math.round(comfortableMinutes * 0.5))
  return Math.max(floor, Math.round(currentCapacity * factor))
}

export const SUBJECT_STYLES: Record<
  string,
  { bg: string; iconBg: string; iconColor: string }
> = {
  lavender: { bg: 'bg-[#EEE8FF]', iconBg: 'bg-[#EEE8FF]', iconColor: 'text-[#7C5CC4]' },
  sage:     { bg: 'bg-[#E2F5EC]', iconBg: 'bg-[#E2F5EC]', iconColor: 'text-[#2B7A52]' },
  amber:    { bg: 'bg-[#FFF3E0]', iconBg: 'bg-[#FFF3E0]', iconColor: 'text-[#D07A1A]' },
  sky:      { bg: 'bg-[#E0F0FF]', iconBg: 'bg-[#E0F0FF]', iconColor: 'text-[#1A7AC4]' },
  rose:     { bg: 'bg-[#FFE8EC]', iconBg: 'bg-[#FFE8EC]', iconColor: 'text-[#C4364A]' },
  emerald:  { bg: 'bg-[#E0FFF3]', iconBg: 'bg-[#E0FFF3]', iconColor: 'text-[#1A8A62]' },
}

export const SUBJECT_COLORS: import('./types').SubjectColor[] = [
  'lavender', 'sage', 'amber', 'sky', 'rose', 'emerald',
]
export const SUBJECT_ICONS: import('./types').SubjectIcon[] = [
  'atom', 'flask', 'calculator', 'globe', 'book', 'microscope', 'landmark', 'code',
]
