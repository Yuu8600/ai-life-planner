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
  sm: 10,
  md: 14,
  lg: 18,
  control: 12,
  button: 12,
  card: 18,
  dialog: 22,
  pill: 999,
} as const;
export const typography = {
  screenTitle: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  dialogTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  button: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  timeLabel: { fontSize: 13, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const;
export const controls = {
  minimumTarget: 44,
  buttonHeight: 46,
  inputHeight: 48,
  borderWidth: 1,
  focusWidth: 2,
  focusOffset: 2,
} as const;
export const surfaces = {
  dialogMaxWidth: 640,
  popoverMaxWidth: 400,
  dialogMargin: 16,
  shadowOpacity: 0.1,
  shadowRadius: 20,
} as const;
