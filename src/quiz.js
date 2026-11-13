export const DIFFICULTY_TIME_SECONDS = {
  Easy: 5 * 60,
  Medium: 3 * 60,
  Hard: 1 * 60,
};

export function createQuestion(random = Math.random) {
  const maxFactor = 12;
  return {
    left: Math.floor(random() * maxFactor) + 1,
    right: Math.floor(random() * maxFactor) + 1,
  };
}

export function validateTypedAnswer(rawValue) {
  const value = rawValue.trim();

  if (!value || !/^\d+$/.test(value)) {
    return { valid: false, message: 'Enter a whole-number answer using digits only.' };
  }

  const answer = Number(value);
  if (!Number.isSafeInteger(answer)) {
    return { valid: false, message: 'That number is too long. Try again.' };
  }

  return { valid: true, answer };
}

export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function sortRecentSessions(sessions) {
  return [...sessions].sort((first, second) => (
    new Date(second.completedAt).getTime() - new Date(first.completedAt).getTime()
  ));
}
