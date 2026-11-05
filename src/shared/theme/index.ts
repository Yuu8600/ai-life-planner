export const colors = {
  background: '#F5F7F5',
  surface: '#FFFFFF',
  text: '#18211D',
  textMuted: '#66736D',
  textSubtle: '#65736C',
  accent: '#2F7564',
  accentPressed: '#255E51',
  accentSoft: '#E6F1ED',
  accentMuted: '#B9D5CC',
  border: '#DDE4E0',
  calendar: '#5D696F',
  calendarSoft: '#EDF0F1',
  warning: '#7A5B26',
  warningSoft: '#F6EFDF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  screenTitle: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  sectionTitle: { fontSize: 19, lineHeight: 27, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  caption: { fontSize: 13, lineHeight: 20 },
} as const;
