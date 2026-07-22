export function timeAgo(input: Date | string | number | undefined, locale = 'en', now: Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input ?? 0);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const units: Array<{
    unit: Intl.RelativeTimeFormatUnit;
    seconds: number;
  }> = [
    { unit: 'year', seconds: 31_536_000 },
    { unit: 'month', seconds: 2_592_000 },
    { unit: 'week', seconds: 604_800 },
    { unit: 'day', seconds: 86_400 },
    { unit: 'hour', seconds: 3_600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  });

  for (const item of units) {
    if (Math.abs(seconds) >= item.seconds || item.unit === 'second') {
      return formatter.format(Math.round(seconds / item.seconds), item.unit);
    }
  }

  return formatter.format(0, 'second');
}
