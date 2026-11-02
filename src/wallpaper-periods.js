export const TIME_PERIODS = [
  { id: 'morning', label: '早晨', hours: '05:00–10:00' },
  { id: 'day', label: '白天', hours: '10:00–17:00' },
  { id: 'evening', label: '傍晚', hours: '17:00–20:00' },
  { id: 'night', label: '夜间', hours: '20:00–05:00' },
];

export function timePeriod(date = new Date()) {
  const hour = date.getHours();
  return TIME_PERIODS[hour >= 5 && hour < 10 ? 0 : hour >= 10 && hour < 17 ? 1 : hour >= 17 && hour < 20 ? 2 : 3];
}
