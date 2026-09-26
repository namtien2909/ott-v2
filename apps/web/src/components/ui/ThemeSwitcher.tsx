import { useTheme } from "../../theme/useTheme";
import type { ThemeChoice } from "../../theme/theme.types";

const labels: Record<ThemeChoice, string> = { light: "Sáng", dark: "Tối", system: "Hệ thống" };
export function ThemeSwitcher({ expanded = false, onChange }: { expanded?: boolean; onChange?: (theme: ThemeChoice) => void }) {
  const { theme, setTheme } = useTheme();
  return <label className={`theme-switcher${expanded ? " expanded" : ""}`}><span className={expanded ? "" : "visually-hidden"}>Giao diện</span><select value={theme} onChange={(event) => { const next = event.target.value as ThemeChoice; setTheme(next); onChange?.(next); }} aria-label="Chọn giao diện">{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>;
}
