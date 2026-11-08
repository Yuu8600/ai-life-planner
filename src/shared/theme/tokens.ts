export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  base: 16,
  section: 20,
} as const;
export const radius = {
  sm: 8,
  md: 12,
  lg: 12,
  control: 8,
  button: 10,
  card: 12,
  dialog: 16,
  pill: 999,
} as const;
export const typography = {
  screenTitle: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  dialogTitle: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secondary: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  timeLabel: { fontSize: 13, lineHeight: 20, fontWeight: '500', fontVariant: ['tabular-nums'] },
} as const;
export const controls = {
  minimumTarget: 44,
  buttonHeight: 48,
  inputHeight: 50,
  borderWidth: 1,
  focusWidth: 2,
  focusOffset: 2,
} as const;
export const surfaces = {
  dialogMaxWidth: 640,
  popoverMaxWidth: 400,
  dialogMargin: 16,
  shadowOpacity: 0.14,
  shadowRadius: 24,
} as const;
