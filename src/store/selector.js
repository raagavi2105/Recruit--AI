// src/store/selectors.js
export function candidateTopScore(candidate) {
  if (!candidate?.interviews?.length) return null;
  const scores = candidate.interviews.map(it => (typeof it.finalScore === 'number' ? it.finalScore : null)).filter(Boolean);
  return scores.length ? Math.max(...scores) : null;
}
