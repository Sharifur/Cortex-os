export function computeNextRunAt(recurrence: string, recurrenceTimeUtc: string): Date {
  const [hourStr, minuteStr] = recurrenceTimeUtc.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));

  if (recurrence === 'daily') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (recurrence === 'weekly') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (recurrence === 'weekdays') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  return next;
}
