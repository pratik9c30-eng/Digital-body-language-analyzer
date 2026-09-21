export const CALIBRATION_MINIMUM = 10;
export const CALIBRATION_TARGET = CALIBRATION_MINIMUM * 3;
export type Behavior = 'typing' | 'mouse' | 'scroll';
export type BehaviorCounts = Record<Behavior, number>;
export type CalibrationProgress = { counts: BehaviorCounts; vectors: Record<Behavior, Record<string, number>[]> };

const STORAGE_KEY = 'dbla:calibration-progress:';
const emptyCounts = (): BehaviorCounts => ({ typing: 0, mouse: 0, scroll: 0 });
const emptyVectors = (): Record<Behavior, Record<string, number>[]> => ({ typing: [], mouse: [], scroll: [] });

export function emptyProgress(): CalibrationProgress { return { counts: emptyCounts(), vectors: emptyVectors() }; }
export function loadCalibrationProgress(userId: string): CalibrationProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}${userId}`) || 'null') as CalibrationProgress | null;
    return saved?.counts && saved.vectors ? saved : emptyProgress();
  } catch { return emptyProgress(); }
}
export function saveCalibrationProgress(userId: string, progress: CalibrationProgress) { localStorage.setItem(`${STORAGE_KEY}${userId}`, JSON.stringify(progress)); }
export function clearCalibrationProgress(userId: string) { localStorage.removeItem(`${STORAGE_KEY}${userId}`); }
export function isCalibrationComplete(counts: BehaviorCounts) { return (Object.keys(emptyCounts()) as Behavior[]).every((behavior) => counts[behavior] >= CALIBRATION_MINIMUM); }
export function totalCollected(counts: BehaviorCounts) { return counts.typing + counts.mouse + counts.scroll; }
export function missingBehaviors(counts: BehaviorCounts) { return (Object.keys(emptyCounts()) as Behavior[]).filter((behavior) => counts[behavior] < CALIBRATION_MINIMUM); }
