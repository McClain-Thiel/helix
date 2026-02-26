import React, { createContext, useContext } from 'react';
import { tokens, type Tokens } from './tokens';

interface ThemeContextValue {
  tokens: Tokens;
  mode: 'dark'; // light mode in Month 4
}

const ThemeContext = createContext<ThemeContextValue>({
  tokens,
  mode: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ tokens, mode: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
