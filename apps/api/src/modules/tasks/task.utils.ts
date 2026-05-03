export function computeNextRunAt(
  recurrence: string,
  recurrenceTimeUtc: string,
  recurrenceDow?: number | null,
  recurrenceDom?: number | null,
): Date {
  const [hourStr, minuteStr] = recurrenceTimeUtc.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const now = new Date();

  if (recurrence === 'daily') {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (recurrence === 'weekly') {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
    if (recurrenceDow !== null && recurrenceDow !== undefined) {
      const currentDow = next.getUTCDay();
      let daysUntil = (recurrenceDow - currentDow + 7) % 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setUTCDate(next.getUTCDate() + daysUntil);
    } else {
      if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
    }
    return next;
  }

  if (recurrence === 'monthly') {
    const dom = recurrenceDom ?? 1;
    let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dom, hour, minute, 0, 0));
    if (next <= now) {
      next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dom, hour, minute, 0, 0));
    }
    return next;
  }

  if (recurrence === 'weekdays') {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
}
