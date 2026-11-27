import { createContext, useContext, type ReactNode } from 'react';
const Context = createContext<() => void>(() => {});
export function SuccessFeedbackProvider({
  children,
  onSuccess,
}: {
  children: ReactNode;
  onSuccess: () => void;
}) {
  return <Context.Provider value={onSuccess}>{children}</Context.Provider>;
}
export const useSuccessFeedback = () => useContext(Context);
