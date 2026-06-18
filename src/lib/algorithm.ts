import type {
  Subject,
  TodayScheduleItem,
  User,
  SessionFeedback,
  StudySessionRecord,
  EnergyLevel,
  LectureDifficulty,
} from "./types";

// ─── Psychology Rhythm Engine ────────────────────────────────────────────────
// Brick is a mentor, not a tracker. The rhythm moves gently, never aggressively.
//
// Rules:
//   3 Easy sessions in the last window         → +5 min
//   3 Comfortable sessions in the last window  → +2 min
//   Difficult                                  → hold
//   2 Difficult sessions in a row              → pause progression (hold + cooldown flag)
//   Could not finish                           → −3 min (gentle reduction)
//
// Hard caps:
//   - Never grow more than 10% above the rhythm from 7 days ago.
//   - Never exceed the user's chosen maximum daily duration.
// Floor: never drop below 50% of the user's reported comfortable starting rhythm.

export interface CapacityResult {
  newCapacity: number;
  updatedFeedback: SessionFeedback[];
  /** New confidence score after this feedback */
  confidenceScore: number;
  /** True if the engine intentionally paused growth (cooldown after 2 difficult) */
  progressionPaused: boolean;
  /** Optional short note the mentor can surface to the user */
  note: string | null;
}

// ─── Confidence Engine ───────────────────────────────────────────────────────
// Each completed session adjusts a running confidence score.
//   Easy          +2
//   Comfortable   +1
//   Difficult     -1
//   Couldn't      -3
//
// When the score crosses +5  → rhythm grows by 2 minutes, score resets to 0.
// When it crosses -3          → rhythm eases by 2 minutes, score resets to 0.
// All other sessions just nudge the score so changes feel smooth and stable.
export const CONFIDENCE_DELTA: Record<SessionFeedback, number> = {
  easy: 2,
  comfortable: 1,
  difficult: -1,
  "couldnt-finish": -3,
};

/** Absolute hard ceiling for any single-session recommendation, anywhere.
 *  Deliberately 120 minutes (2h) to prevent burnout — the rhythm engine
 *  will never schedule a single session beyond this, even if the user's
 *  stated upper limit (maxRhythm) is higher. The user's maxRhythm is kept
 *  as a personal preference and can only lower this cap, never raise it. */
export const RHYTHM_CEILING = 120;
/** Absolute hard floor. The rhythm never drops below this. */
export const RHYTHM_FLOOR = 10;

export interface RhythmResult {
  newCapacity: number;
  note: string | null;
}

export function adjustCapacityFromStudyTime(
  currentCapacity: number,
  comfortableMinutes: number,
  actualMinutes: number,
  maxRhythm: number = RHYTHM_CEILING,
): RhythmResult {
  maxRhythm = Math.min(maxRhythm, RHYTHM_CEILING);
  // Set the absolute recommendation floor to 20 minutes baseline
  const floor = Math.max(20, Math.round(comfortableMinutes * 0.5));
  let newCapacity = currentCapacity;

  if (actualMinutes > currentCapacity) {
    newCapacity = Math.min(maxRhythm, currentCapacity + 2);
  } else if (actualMinutes < currentCapacity) {
    newCapacity = Math.max(floor, currentCapacity - 2);
  }

  return {
    newCapacity,
    note: null,
  };
}

export function getReasonRecoveryMessage(reason: string): string {
  const normalized = reason.toLowerCase().trim();
  if (normalized.includes("health")) {
    return "Take your time recovering. Your house waits for you.";
  }
  if (normalized.includes("energy")) {
    return "Energy flows and ebbs. Today we rest, tomorrow we build.";
  }
  if (normalized.includes("emergency")) {
    return "Life happens. Take care of what matters most first.";
  }
  if (normalized.includes("busy")) {
    return "A full day. Tomorrow we'll find a quiet window.";
  }
  if (normalized.includes("motivation")) {
    return "Motivation is a visitor; habit is the builder. We'll start very small next time.";
  }
  return "Every day has its own story. Let's begin fresh tomorrow.";
}

// ─── Energy adjustment (today-only) ──────────────────────────────────────────
// Daily check-in scales today's assigned minutes WITHOUT touching long-term rhythm.
export const ENERGY_MULTIPLIER: Record<EnergyLevel, number> = {
  good: 1.0,
  okay: 0.85,
  low: 0.7,
};

export function adjustCapacityForEnergy(
  capacity: number,
  energy: EnergyLevel | null | undefined,
  honestyDampener: number = 1,
): number {
  if (!energy) return capacity;
  const baseMult = ENERGY_MULTIPLIER[energy];
  // honestyDampener ∈ [0..1] — 1 means full effect, 0 means ignore the report.
  // We only ever soften reductions (energy < 1), never amplify them.
  const effectiveMult = baseMult >= 1 ? baseMult : 1 - (1 - baseMult) * honestyDampener;
  return Math.max(10, Math.round(capacity * effectiveMult));
}

// ─── Energy honesty ──────────────────────────────────────────────────────────
// If a user repeatedly reports "low" energy but completes assignments easily,
// Brick quietly trusts the report less. Returns a multiplier in [0..1]:
//   1.0 → full trust  ·  0.4 → trust is halved
export function computeEnergyHonesty(
  history: { date: string; energy: EnergyLevel; completionPct: number }[] | undefined,
): number {
  if (!history || history.length < 4) return 1;
  const recent = history.slice(-10);
  let lowReports = 0;
  let lowOvershoot = 0;
  for (const h of recent) {
    if (h.energy === "low" || h.energy === "okay") {
      lowReports++;
      if (h.completionPct >= 0.95) lowOvershoot++;
    }
  }
  if (lowReports < 3) return 1;
  const overshootRate = lowOvershoot / lowReports;
  // Smooth dampener: 0 overshoot → 1.0, 100% overshoot → 0.4
  return Math.max(0.4, 1 - overshootRate * 0.6);
}

// ─── Lecture difficulty ──────────────────────────────────────────────────────
// Heavy lectures consume more of today's rhythm; easy lectures consume slightly less.
export const DIFFICULTY_WEIGHT: Record<LectureDifficulty, number> = {
  easy: 0.8,
  moderate: 1.0,
  heavy: 1.3,
};

export function difficultyWeight(d: LectureDifficulty | undefined): number {
  return d ? DIFFICULTY_WEIGHT[d] : 1.0;
}

// ─── Weighted Subject Rotation ───────────────────────────────────────────────
// Brick decides what to study so the student doesn't have to.
// Each subject gets a score from three signals:
//   • Workload  — more pending lectures => higher score (logarithmic, so 200 vs 20 doesn't drown out 20)
//   • Recency   — longer since last touched => higher score
//   • Neglect   — fewer sessions in the last 14 days => higher score
// Subjects are then visited highest-score-first when packing today's rhythm.

interface RankedSubject {
  subject: Subject;
  score: number;
}

function rankSubjects(subjects: Subject[], sessions: StudySessionRecord[]): Subject[] {
  const now = Date.now();
  const DAY = 86400000;
  const lastTouched = new Map<string, number>();
  const recentCount = new Map<string, number>();

  for (const s of sessions) {
    const t = new Date(s.date).getTime();
    if (now - t > 14 * DAY) continue;
    lastTouched.set(s.subjectId, Math.max(lastTouched.get(s.subjectId) ?? 0, t));
    recentCount.set(s.subjectId, (recentCount.get(s.subjectId) ?? 0) + 1);
  }

  const withPending = subjects.filter(
    (s) => !s.archived && s.lectures.some((l) => l.status === "pending"),
  );

  const ranked: RankedSubject[] = withPending.map((subject) => {
    const pending = subject.lectures.filter((l) => l.status === "pending").length;
    const last = lastTouched.get(subject.id);
    const daysSince = last ? Math.min(30, (now - last) / DAY) : 30;
    const recent = recentCount.get(subject.id) ?? 0;

    // Workload: logarithmic so 200 lectures ≈ 5.3, 50 ≈ 3.9, 20 ≈ 3.0, 5 ≈ 1.8
    const workload = Math.log2(1 + pending) * 2;
    // Recency: 0..6 (more days since = higher score, soft cap)
    const recency = Math.min(6, daysSince * 0.6);
    // Neglect: penalise subjects that already got plenty of attention this fortnight
    const neglect = Math.max(0, 4 - recent);
    // Starvation guarantee: any subject untouched for a week (or never) jumps
    // to the front of the line, regardless of how small its workload is.
    const starvationBoost = !last || daysSince >= 7 ? 5 : 0;

    return { subject, score: workload + recency + neglect + starvationBoost };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.map((r) => r.subject);
}

// ─── Schedule Builder ─────────────────────────────────────────────────────────

/**
 * Builds today's assignment by walking the weighted-ranked subject list and
 * picking the next pending lecture from each, until today's rhythm is filled.
 * `capacityMinutes` should already be energy-adjusted by the caller.
 */
export function buildTodaySchedule(
  subjects: Subject[],
  capacityMinutes: number,
  sessions: StudySessionRecord[] = [],
): TodayScheduleItem[] {
  const schedule: TodayScheduleItem[] = [];
  let remaining = capacityMinutes;
  let isFirst = true;

  const ranked = rankSubjects(subjects, sessions);

  for (const subject of ranked) {
    if (remaining <= 0) break;

    const pendingLecture = subject.lectures.find((l) => l.status === "pending");
    if (!pendingLecture) continue;

    const alreadyWatched = pendingLecture.watchedMinutes;
    const lectureRemaining = pendingLecture.durationMinutes - alreadyWatched;
    if (lectureRemaining <= 0) continue;

    // Scale how much of today's rhythm this lecture consumes by difficulty.
    const weight = difficultyWeight(pendingLecture.difficulty);
    // Effective minutes the user actually studies, capped by remaining rhythm/weight.
    const watchTarget = Math.min(lectureRemaining, Math.floor(remaining / weight));
    if (watchTarget <= 0) continue;

    schedule.push({
      subjectId: subject.id,
      lectureId: pendingLecture.id,
      targetMinutes: watchTarget,
      watchedFrom: alreadyWatched,
      status: isFirst ? "in-progress" : "upcoming",
    });

    remaining -= Math.ceil(watchTarget * weight);
    isFirst = false;
  }

  return schedule;
}

// ─── Smart Mentor ─────────────────────────────────────────────────────────────
// Messages adapt to what's actually happening — recovery, low energy, growth,
// consistency, paused progression — and only fall back to general lines.

export interface MentorContext {
  totalSessions: number;
  recentFeedback: SessionFeedback[];
  daysSinceLastStudy: number;
  recoveryMode?: boolean;
  progressionPaused?: boolean;
  energy?: EnergyLevel | null;
  /** True when the most recent feedback grew the rhythm */
  rhythmGrew?: boolean;
  /** When set, mentor will deliver a one-time stage-specific milestone line. */
  houseStageKey?: HouseStage["key"];
  /** True only on the day the user just crossed into a new house stage. */
  houseStageJustChanged?: boolean;
  // V3 additions
  totalMinutes?: number;
  lastSessionMinutes?: number;
  houseStageLabel?: string;
  streakDays?: number;
}

const GENERAL_MESSAGES = [
  "Focus on today's brick.",
  "Small steps build strong foundations.",
  "Today's effort matters.",
  "Consistency grows quietly.",
  "You don't need to plan. Just begin.",
  "Show up. Place the brick. That's the whole job.",
  "A home is built one brick at a time.",
  "Progress is patient. So are you.",
  "The work you do today settles into your foundation.",
  "Consistency builds the house.",
  "Today's effort moved the house forward."
];

const MENTOR_POOLS = {
  recoveryLong: [
    "Welcome back. We'll rebuild gradually, one quiet brick at a time.",
    "No rush. The home is still here, waiting.",
    "Begin again — softly. That is enough for today.",
  ],
  recoveryMid: [
    "Welcome back. Today's study target is lighter on purpose.",
    "Glad you returned. We start from where you are.",
  ],
  recoveryShort: [
    "Glad you're here. We'll ease back into your study window.",
    "A short pause is fine. Today we resume gently.",
  ],
  lowEnergy: [
    "Let's keep today simple. Showing up is enough.",
    "A small study amount today. That still counts.",
    "Quiet effort still moves the work forward.",
  ],
  okayEnergy: [
    "A calm, steady study day today. Nothing more.",
    "Today, just enough. Tomorrow can be more.",
  ],
  consistent: [
    "Steady. Consistent. This is how homes get built.",
    "The pattern is holding. That is the whole point.",
  ],
  houseMilestone: [
    "A new stage of your home is taking shape.",
    "Look up — the home has changed today.",
    "The work shows. Quietly, the home grew.",
  ],
  general: GENERAL_MESSAGES,
};

function pickFromPool(pool: string[], seed: number): string {
  if (pool.length === 0) return "";
  return pool[Math.abs(seed) % pool.length];
}

// Stage-specific mentor lines. Spoken once when the user just crossed into a new stage.
const STAGE_LINES: Partial<Record<HouseStage["key"], string>> = {
  "foundation-complete": "The foundation is set. The home has its footing.",
  "walls-rising": "One more study day and the first wall will rise higher.",
  window: "A window appeared. Light enters the home.",
  door: "A door now opens. The home is yours to step into.",
  "roof-framework": "The roof beams are up. Shelter is forming overhead.",
  "roof-complete": "The roof is complete. The home is sealed and quiet.",
  "finished-home": "The home is finished. Built slowly. Built by you.",
};

export function getMentorMessage(contextOrTotal: MentorContext | number): string {
  const ctx: MentorContext =
    typeof contextOrTotal === "number"
      ? { totalSessions: contextOrTotal, recentFeedback: [], daysSinceLastStudy: 0 }
      : contextOrTotal;

  // Seed varies by day so messages quietly rotate without feeling random.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const seed = dayOfYear + ctx.totalSessions;

  // 1. Dynamic minutes logged today celebrations (V3)
  if (ctx.lastSessionMinutes && ctx.lastSessionMinutes >= 20) {
    const minutesPool = [
      `You studied ${ctx.lastSessionMinutes} minutes today.`,
      `Today's effort of ${ctx.lastSessionMinutes} minutes moved the house forward.`,
      `With ${ctx.lastSessionMinutes} minutes logged, another brick is added to your foundation.`,
    ];
    return pickFromPool(minutesPool, seed);
  }

  // 2. Streaks and total study minutes celebrations (V3)
  if (ctx.streakDays && ctx.streakDays >= 3) {
    return `You're on a ${ctx.streakDays}-day consistency streak. The house stands strong.`;
  }

  // 3. House milestone takes priority — it's a one-time, contextual celebration.
  if (ctx.houseStageJustChanged && ctx.houseStageKey) {
    const line = STAGE_LINES[ctx.houseStageKey];
    if (line) return line;
    return pickFromPool(MENTOR_POOLS.houseMilestone, seed);
  }

  if (ctx.recoveryMode || ctx.daysSinceLastStudy >= 15)
    return pickFromPool(MENTOR_POOLS.recoveryLong, seed);
  if (ctx.daysSinceLastStudy >= 8) return pickFromPool(MENTOR_POOLS.recoveryMid, seed);
  if (ctx.daysSinceLastStudy >= 4) return pickFromPool(MENTOR_POOLS.recoveryShort, seed);

  if (ctx.energy === "low") return pickFromPool(MENTOR_POOLS.lowEnergy, seed);
  if (ctx.energy === "okay") return pickFromPool(MENTOR_POOLS.okayEnergy, seed);

  if (ctx.totalSessions >= 7 && ctx.daysSinceLastStudy <= 1)
    return pickFromPool(MENTOR_POOLS.consistent, seed);

  // Fallback to total minutes / house stage details if provided (V3)
  if (ctx.totalMinutes && ctx.totalMinutes > 0) {
    const totalMinutesPool = [
      `Your house represents ${ctx.totalMinutes} total minutes of study.`,
      `Every minute of study is a stone in your ${ctx.houseStageLabel || 'home'}.`,
      `Your total study time is now ${formatMinutes(ctx.totalMinutes)}.`,
    ];
    return pickFromPool(totalMinutesPool, seed);
  }

  return pickFromPool(MENTOR_POOLS.general, seed);
}

// ─── House of Knowledge ───────────────────────────────────────────────────────
// Every completed session places one visible brick. The house grows over time.
// After "Completed Home", expansions continue — the journey never ends abruptly.
//
// Visible bricks come straight from completed-session count.
// The stage progression bar can optionally use a weighted effort score
// (longer sessions nudge progress within a stage slightly faster).

export interface HouseStage {
  index: number;
  key:
    | "foundation"
    | "foundation-complete"
    | "walls-rising"
    | "window"
    | "door"
    | "roof-framework"
    | "roof-complete"
    | "finished-home"
    | "study-room"
    | "library"
    | "reading-corner"
    | "garden-expansion"
    | "workshop";
  label: string;
  description: string;
  bricksRequired: number;
  /** Stage threshold expressed as syllabus completion fraction (0..1, or >1 for expansion stages). */
  fractionRequired: number;
  /** Bonus / expansion stages render with a softer tone */
  isExpansion?: boolean;
}

// The 8-stage construction journey. Each stage is a visibly different home.
//   0 Foundation             — ground laid
//   1 Foundation Complete    — full base poured
//   2 Walls Rising           — partial walls of brick
//   3 Window Appears         — first window cut in
//   4 Door Appears           — entryway formed
//   5 Roof Framework         — beams overhead
//   6 Roof Complete          — sealed shelter
//   7 Finished Home          — windows lit, garden, done
export const HOUSE_STAGES: HouseStage[] = [
  {
    index: 0,
    key: "foundation",
    label: "Foundation",
    description: "The ground is set. Every home begins here.",
    bricksRequired: 0,
    fractionRequired: 0,
  },
  {
    index: 1,
    key: "foundation-complete",
    label: "Foundation Complete",
    description: "The base is poured. The home has its footing.",
    bricksRequired: 3,
    fractionRequired: 0.05,
  },
  {
    index: 2,
    key: "walls-rising",
    label: "Walls Rising",
    description: "Brick by brick, the walls take shape.",
    bricksRequired: 8,
    fractionRequired: 0.15,
  },
  {
    index: 3,
    key: "window",
    label: "Window Appears",
    description: "Light enters. The home begins to breathe.",
    bricksRequired: 18,
    fractionRequired: 0.3,
  },
  {
    index: 4,
    key: "door",
    label: "Door Appears",
    description: "A threshold. The home becomes yours.",
    bricksRequired: 30,
    fractionRequired: 0.45,
  },
  {
    index: 5,
    key: "roof-framework",
    label: "Roof Framework",
    description: "Beams overhead. Shelter is on its way.",
    bricksRequired: 45,
    fractionRequired: 0.6,
  },
  {
    index: 6,
    key: "roof-complete",
    label: "Roof Complete",
    description: "Sealed and quiet. The home is whole.",
    bricksRequired: 65,
    fractionRequired: 0.8,
  },
  {
    index: 7,
    key: "finished-home",
    label: "Finished Home",
    description: "Built slowly. Built well. Built by you.",
    bricksRequired: 90,
    fractionRequired: 1.0,
  },
  // Long-term expansions — the journey continues for years.
  {
    index: 8,
    key: "study-room",
    label: "Study Room",
    description: "A quiet room for deeper focus.",
    bricksRequired: 130,
    fractionRequired: 1.1,
    isExpansion: true,
  },
  {
    index: 9,
    key: "library",
    label: "Library",
    description: "Walls of books. A mind that lasts.",
    bricksRequired: 180,
    fractionRequired: 1.2,
    isExpansion: true,
  },
  {
    index: 10,
    key: "reading-corner",
    label: "Reading Corner",
    description: "A soft chair by the window.",
    bricksRequired: 240,
    fractionRequired: 1.3,
    isExpansion: true,
  },
  {
    index: 11,
    key: "garden-expansion",
    label: "Garden Expansion",
    description: "The garden widens, season after season.",
    bricksRequired: 320,
    fractionRequired: 1.45,
    isExpansion: true,
  },
  {
    index: 12,
    key: "workshop",
    label: "Workshop",
    description: "A place to build, beyond the home itself.",
    bricksRequired: 420,
    fractionRequired: 1.65,
    isExpansion: true,
  },
];

// ─── House Scale ─────────────────────────────────────────────────────────────
// The home Brick builds adapts to the size of the user's syllabus.
//   Small  → Cottage,  Medium → House,  Large → Villa,  Very large → Estate
export type HouseScaleKey = "cottage" | "house" | "villa" | "estate";
export interface HouseScale {
  key: HouseScaleKey;
  label: string;
  description: string;
}

export function getHouseScale(totalSyllabusMinutes: number): HouseScale {
  if (totalSyllabusMinutes < 1000)
    return { key: "cottage", label: "Cottage", description: "A small, complete home." };
  if (totalSyllabusMinutes < 5000)
    return { key: "house", label: "House", description: "A steady family home." };
  if (totalSyllabusMinutes < 15000)
    return { key: "villa", label: "Villa", description: "A spacious, layered home." };
  return { key: "estate", label: "Estate", description: "A long, generational home." };
}

export interface HouseState {
  bricks: number;
  level: number;
  stage: HouseStage;
  nextStage: HouseStage | null;
  bricksToNext: number;
  stageFraction: number;
  fraction: number;
  recentRestoration: string | null;
  description: string;
  /** True when syllabus has grown since the progress floor was set — house is expanding. */
  expansion: boolean;
  /** How many additional syllabus minutes were added after the floor was locked. */
  expansionMinutes: number;
}

export interface HouseFloor {
  /** Highest fraction ever achieved, 0..1+. The visible house never drops below this. */
  fraction: number;
  /** Total syllabus minutes when the floor was last captured. */
  totalMinutes: number;
}

export interface SyllabusProgress {
  /** Sum of watchedMinutes across every lecture (capped per lecture). */
  completedMinutes: number;
  /** Sum of every lecture's durationMinutes. */
  totalMinutes: number;
}

/**
 * Compute the House of Knowledge state.
 *
 * The house represents OVERALL SYLLABUS COMPLETION (not session count) when
 * syllabus progress is provided. Brick count remains visible — it's how
 * Brick celebrates each placed brick — but stage transitions are driven by
 * how much of the syllabus the student has actually completed.
 *
 * Back-compat: if `syllabus` is omitted, stage progression falls back to the
 * old brick-count thresholds.
 */
export function getHouseState(
  totalSessions: number,
  effortScore?: number,
  syllabus?: SyllabusProgress,
  floor?: HouseFloor,
  totalStudyMinutes?: number,
  totalEffectiveMinutes?: number,
  baselineMinutes: number = 20,
): HouseState {
  const bricks = Math.max(0, totalSessions);

  // ── Syllabus-driven progression ───────────────────────────────────────────
  if (syllabus && syllabus.totalMinutes > 0) {
    const fractionRaw = syllabus.completedMinutes / syllabus.totalMinutes;
    // The visible house never decreases — apply the floor.
    const floorFraction = floor?.fraction ?? 0;
    const fraction = Math.max(0, fractionRaw, floorFraction);
    const expansion =
      !!floor &&
      floor.totalMinutes > 0 &&
      syllabus.totalMinutes > floor.totalMinutes &&
      fractionRaw < floorFraction;
    const expansionMinutes = expansion
      ? Math.max(0, syllabus.totalMinutes - floor.totalMinutes)
      : 0;

    let level = 0;
    for (let i = HOUSE_STAGES.length - 1; i >= 0; i--) {
      if (fraction >= HOUSE_STAGES[i].fractionRequired) {
        level = i;
        break;
      }
    }
    const stage = HOUSE_STAGES[level];
    const nextStage = HOUSE_STAGES[level + 1] ?? null;
    const stageSpan = nextStage ? nextStage.fractionRequired - stage.fractionRequired : 0;
    const stageFraction =
      stageSpan > 0 ? Math.min(1, Math.max(0, (fraction - stage.fractionRequired) / stageSpan)) : 1;
    const minutesToNext = nextStage
      ? Math.max(0, (nextStage.fractionRequired - fraction) * syllabus.totalMinutes)
      : 0;
    const bricksToNext = nextStage
      ? Math.max(1, Math.ceil(minutesToNext / baselineMinutes))
      : 0;

    return {
      bricks,
      level,
      stage,
      nextStage,
      bricksToNext,
      stageFraction,
      fraction: Math.min(1, fraction),
      recentRestoration: bricks > 0 ? `+1 brick placed` : null,
      description: stage.description,
      expansion,
      expansionMinutes,
    };
  }

  // ── Fallback: study minutes progression (direct scale, no virtual bricks) ──
  const baseline = baselineMinutes;
  const effectiveMinutesStudied = totalEffectiveMinutes !== undefined ? totalEffectiveMinutes : (bricks * baseline);
  let level = 0;
  for (let i = HOUSE_STAGES.length - 1; i >= 0; i--) {
    const minutesRequired = HOUSE_STAGES[i].bricksRequired * baseline;
    if (effectiveMinutesStudied >= minutesRequired) {
      level = i;
      break;
    }
  }
  const stage = HOUSE_STAGES[level];
  const nextStage = HOUSE_STAGES[level + 1] ?? null;
  
  const currentStageMinutes = stage.bricksRequired * baseline;
  const nextStageMinutes = nextStage ? nextStage.bricksRequired * baseline : currentStageMinutes;
  const stageSpanMinutes = nextStageMinutes - currentStageMinutes;
  
  const minutesToNext = nextStage ? Math.max(0, nextStageMinutes - effectiveMinutesStudied) : 0;
  const bricksToNext = nextStage ? Math.ceil(minutesToNext / baseline) : 0;
  
  let withinFromMinutes = nextStage ? effectiveMinutesStudied - currentStageMinutes : stageSpanMinutes;
  const stageFraction = stageSpanMinutes > 0 ? Math.min(1, withinFromMinutes / stageSpanMinutes) : 1;
  
  const minutesForFull = HOUSE_STAGES[7].bricksRequired * baseline;
  const fraction = Math.min(1, effectiveMinutesStudied / minutesForFull);

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
    expansion: false,
    expansionMinutes: 0,
  };
}

/** Aggregate completed vs. total minutes across the syllabus. Archived subjects are excluded. */
export function getSyllabusProgress(subjects: Subject[]): SyllabusProgress {
  let completed = 0;
  let total = 0;
  for (const s of subjects) {
    if (s.archived) continue;
    for (const l of s.lectures) {
      total += l.durationMinutes;
      completed += Math.min(l.watchedMinutes, l.durationMinutes);
    }
  }
  return { completedMinutes: completed, totalMinutes: total };
}

/** Effort score: each session contributes 1 + a small bonus per 30 minutes. */
export function computeEffortScore(sessions: StudySessionRecord[]): number {
  let score = 0;
  for (const s of sessions) {
    if (!s.completed) continue;
    score += 1 + Math.min(0.5, s.actualMinutes / 60); // capped bonus of 0.5 per session
  }
  return score;
}

// Back-compat alias for screens that still import the old name.
export const getObservatoryState = (totalSessions: number) => {
  const h = getHouseState(totalSessions);
  return {
    level: h.level,
    description: h.description,
    recentRestoration: h.recentRestoration,
    fraction: h.fraction,
    stage: h.stage,
    nextStage: h.nextStage,
    bricksToNext: h.bricksToNext,
    bricks: h.bricks,
  };
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getLogicalStudyDate(date: Date = new Date()): string {
  const d = new Date(date);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getWeekDays(): { day: string; date: number; isToday: boolean; offset: number }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return { day: days[d.getDay()], date: d.getDate(), isToday: offset === 0, offset };
  });
}

export function parseSubjectText(text: string): {
  name: string;
  lectures: { name: string; durationMinutes: number }[];
}[] {
  const results: { name: string; lectures: { name: string; durationMinutes: number }[] }[] = [];
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let currentSubject: {
    name: string;
    lectures: { name: string; durationMinutes: number }[];
  } | null = null;

  for (const line of lines) {
    const lectureMatch = line.match(/^(.+?)\s*[-–—]\s*(\d+)\s*min/i);
    if (lectureMatch && currentSubject) {
      currentSubject.lectures.push({
        name: lectureMatch[1].trim(),
        durationMinutes: parseInt(lectureMatch[2], 10),
      });
    } else if (!lectureMatch) {
      currentSubject = { name: line, lectures: [] };
      results.push(currentSubject);
    }
  }
  return results.filter((s) => s.lectures.length > 0);
}

/** A user is "away" if last study was 3+ days ago. Used for the gentle welcome-back screen. */
export function isLongGap(lastStudyDate: string | null): boolean {
  if (!lastStudyDate) return false;
  const last = new Date(lastStudyDate);
  const today = new Date();
  const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 4;
}

/** Days away since last study (0 if same day). */
export function daysAway(lastStudyDate: string | null): number {
  if (!lastStudyDate) return 0;
  const last = new Date(lastStudyDate);
  const today = new Date();
  return Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86400000));
}

// ─── Missed-day Recovery ─────────────────────────────────────────────────────
// 1-3 days   → no change
// 4-7 days   → reduce rhythm by 10%
// 8-14 days  → reduce rhythm by 20%, activate recovery mode
// 15+ days   → start recovery onboarding (the caller routes the user there)
export interface RecoveryResult {
  newCapacity: number;
  recoveryMode: boolean;
  needsRecoveryOnboarding: boolean;
  mentorNote: string | null;
}

export function applyMissedDayRecovery(
  currentCapacity: number,
  comfortableMinutes: number,
  daysAwayCount: number,
): RecoveryResult {
  const floor = Math.max(10, Math.round(comfortableMinutes * 0.5));

  if (daysAwayCount >= 15) {
    return {
      newCapacity: Math.max(floor, comfortableMinutes),
      recoveryMode: true,
      needsRecoveryOnboarding: true,
      mentorNote: "Welcome back. We\u2019ll rebuild gradually.",
    };
  }
  if (daysAwayCount >= 8) {
    return {
      newCapacity: Math.max(floor, Math.round(currentCapacity * 0.8)),
      recoveryMode: true,
      needsRecoveryOnboarding: false,
      mentorNote: "Welcome back. Today\u2019s daily target is lighter on purpose.",
    };
  }
  if (daysAwayCount >= 4) {
    return {
      newCapacity: Math.max(floor, Math.round(currentCapacity * 0.9)),
      recoveryMode: false,
      needsRecoveryOnboarding: false,
      mentorNote: "Glad you\u2019re here. We\u2019ll ease back into consistency.",
    };
  }
  return {
    newCapacity: currentCapacity,
    recoveryMode: false,
    needsRecoveryOnboarding: false,
    mentorNote: null,
  };
}

/** Back-compat shim — older callers still import easedCapacityAfterGap. */
export function easedCapacityAfterGap(
  currentCapacity: number,
  comfortableMinutes: number,
  daysAwayCount: number,
): number {
  return applyMissedDayRecovery(currentCapacity, comfortableMinutes, daysAwayCount).newCapacity;
}

export const SUBJECT_STYLES: Record<string, { bg: string; iconBg: string; iconColor: string }> = {
  lavender: { bg: "bg-[#EEE8FF]", iconBg: "bg-[#EEE8FF]", iconColor: "text-[#7C5CC4]" },
  sage: { bg: "bg-[#E2F5EC]", iconBg: "bg-[#E2F5EC]", iconColor: "text-[#2B7A52]" },
  amber: { bg: "bg-[#FFF3E0]", iconBg: "bg-[#FFF3E0]", iconColor: "text-[#D07A1A]" },
  sky: { bg: "bg-[#E0F0FF]", iconBg: "bg-[#E0F0FF]", iconColor: "text-[#1A7AC4]" },
  rose: { bg: "bg-[#FFE8EC]", iconBg: "bg-[#FFE8EC]", iconColor: "text-[#C4364A]" },
  emerald: { bg: "bg-[#E0FFF3]", iconBg: "bg-[#E0FFF3]", iconColor: "text-[#1A8A62]" },
};

export const SUBJECT_COLORS: import("./types").SubjectColor[] = [
  "lavender",
  "sage",
  "amber",
  "sky",
  "rose",
  "emerald",
];
export const SUBJECT_ICONS: import("./types").SubjectIcon[] = [
  "atom",
  "flask",
  "calculator",
  "globe",
  "book",
  "microscope",
  "landmark",
  "code",
];

// ─── Lecture edit validation ─────────────────────────────────────────────────
// Completed lectures are immutable. Pending lectures can be edited freely.
// Partial-progress lectures can be edited but a duration shrink below the
// already-watched minutes must be confirmed explicitly by the caller.
import type { Lecture as _Lecture } from "./types";
export type LectureEditValidation =
  | { ok: true }
  | { ok: false; reason: "completed-locked" | "duration-below-watched"; message: string };

export function validateLectureEdit(
  lecture: _Lecture,
  next: { durationMinutes?: number },
): LectureEditValidation {
  if (lecture.status === "completed") {
    return {
      ok: false,
      reason: "completed-locked",
      message: "Completed lectures are locked to keep your progress honest.",
    };
  }
  if (next.durationMinutes !== undefined && next.durationMinutes < lecture.watchedMinutes) {
    return {
      ok: false,
      reason: "duration-below-watched",
      message: `You've already studied ${lecture.watchedMinutes} minutes. Shrink confirmation required.`,
    };
  }
  return { ok: true };
}

/** Dynamic streak calculation from completed sessions list. */
export function calculateStreak(sessions: StudySessionRecord[]): { current: number; longest: number } {
  // Get unique sorted dates where a brick was successfully placed (completed is true)
  const completedDates = Array.from(
    new Set(
      sessions
        .filter((s) => s.completed)
        .map((s) => s.date)
    )
  ).sort();

  if (completedDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  let current = 0;
  const today = getLogicalStudyDate(new Date());
  
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLogicalStudyDate(yesterdayDate);

  const set = new Set(completedDates);
  let checkDate = new Date();

  // Calculate current streak backward from today or yesterday
  if (set.has(today)) {
    current = 1;
    checkDate.setDate(checkDate.getDate() - 1);
    while (set.has(getLogicalStudyDate(checkDate))) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else if (set.has(yesterday)) {
    current = 1;
    checkDate.setDate(checkDate.getDate() - 2);
    while (set.has(getLogicalStudyDate(checkDate))) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // Calculate longest streak of consecutive days
  let longest = 0;
  let running = 0;
  let prevTime: number | null = null;

  for (const dateStr of completedDates) {
    // parse date in local format
    const parts = dateStr.split('-');
    const currTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
    if (prevTime === null) {
      running = 1;
    } else {
      const diffDays = Math.round((currTime - prevTime) / 86400000);
      if (diffDays === 1) {
        running++;
      } else if (diffDays > 1) {
        running = 1;
      }
    }
    prevTime = currTime;
    if (running > longest) {
      longest = running;
    }
  }

  longest = Math.max(longest, current);
  return { current, longest };
}
