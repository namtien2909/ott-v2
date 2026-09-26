import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme phải được dùng bên trong ThemeProvider.");
  return value;
}
