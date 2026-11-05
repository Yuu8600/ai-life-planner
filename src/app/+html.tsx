import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

// Expo Router SDK 57: server-rendered document shell for the static web export.
export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>AI Life Planner Demo</title>
        <meta
          name="description"
          content="目標・タスクとサンプル予定から一日の計画を作る、ログイン不要のWeb Demo。"
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
