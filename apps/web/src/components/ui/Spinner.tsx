export function Spinner({ size = "medium", label }: { size?: "small" | "medium" | "large"; label?: string }) {
  return <span className={`spinner ${size}`} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
