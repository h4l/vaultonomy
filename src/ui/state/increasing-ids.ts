let _nextIncreasingId = 0;

export function getIncreasingId(): number {
  return _nextIncreasingId++;
}
