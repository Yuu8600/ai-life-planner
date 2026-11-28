import { createContext, useContext, type ReactNode } from 'react';
/** Optional app-wide status displayed inside the existing fixed screen header. */
const Context = createContext<ReactNode>(null);
export const ScreenHeaderAccessoryProvider = Context.Provider;
export const useScreenHeaderAccessory = () => useContext(Context);
