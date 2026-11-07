import { createContext, useContext, useState, type ReactNode } from 'react';

import { DemoRepositories } from '@/services/demo/DemoRepositories';

type DemoContextValue = {
  repositories: DemoRepositories;
  revision: number;
  reset: () => void;
  advance: () => void;
  overnight: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [repositories, setRepositories] = useState(() => new DemoRepositories());
  const [revision, setRevision] = useState(0);
  return (
    <DemoContext.Provider
      value={{
        repositories,
        revision,
        reset: () => {
          setRepositories(new DemoRepositories());
          setRevision((value) => value + 1);
        },
        overnight: () => {
          repositories.advanceToOvernight();
          setRevision((value) => value + 1);
        },
        advance: () => {
          repositories.advanceToAfternoon();
          setRevision((value) => value + 1);
        },
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is required.');
  return value;
}
