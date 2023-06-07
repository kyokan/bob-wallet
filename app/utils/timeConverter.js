import { app } from '@electron/remote';

export function hoursToNow(hoursUntil) {
  if (!hoursUntil) {
    return 'N/A';
  }

  if (hoursUntil < 24) {
    const hours = Math.floor(hoursUntil % 24);
    const mins = Math.floor((hoursUntil % 1) * 60);
    return `~${hours}h ${mins}m`
  }

  const days = Math.floor(hoursUntil / 24);
  const hours = Math.floor(hoursUntil % 24);
  const mins = Math.floor((hoursUntil % 1) * 60);
  return `~${days}d ${hours}h ${mins}m`
}

// TODO: remove before merge
console.warn('locale:', {
  locale: app.getLocale(),
  systemLocale: app.getSystemLocale(),
  preferredSystemLanguages: app.getPreferredSystemLanguages(),
});

const locale = app.getLocale();
export const dateTimeFormatters = {
  date: new Intl.DateTimeFormat(locale, { dateStyle: 'short' }),
  time: new Intl.DateTimeFormat(locale, { timeStyle: 'short' }),
}
