import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AvatarGlyph, Button } from "../ui";
import { updateProfile, type AvatarPreset, type UserProfile } from "../../services/auth/authApi";
import { ApiError } from "../../services/http/apiError";

const avatarPresets: Array<{ value: AvatarPreset; label: string }> = [
  { value: "robot", label: "Robot" },
  { value: "wolf", label: "Sói" },
  { value: "fox", label: "Cáo" },
  { value: "panda", label: "Gấu trúc" },
  { value: "arena", label: "Đấu trường" },
];

type Draft = Pick<UserProfile, "fullName" | "displayName" | "avatarPreset">;

export function ProfileForm({ user, onSaved, onDirtyChange, submitLabel = "Lưu thay đổi" }: { user: UserProfile; onSaved: (user: UserProfile) => void; onDirtyChange?: (dirty: boolean) => void; submitLabel?: string }) {
  const initial = useMemo<Draft>(() => ({ fullName: user.fullName, displayName: user.displayName, avatarPreset: user.avatarPreset }), [user]);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = draft.fullName !== saved.fullName || draft.displayName !== saved.displayName || draft.avatarPreset !== saved.avatarPreset;

  useEffect(() => { setDraft(initial); setSaved(initial); }, [initial]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await updateProfile(draft);
      const next = { fullName: result.user.fullName, displayName: result.user.displayName, avatarPreset: result.user.avatarPreset };
      setDraft(next); setSaved(next); onSaved(result.user); setMessage("Đã lưu hồ sơ.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Không thể lưu hồ sơ.");
    } finally { setPending(false); }
  };

  return <form className="form-stack" onSubmit={submit}>
    <div><span className="form-hint">Avatar</span><div className="avatar-presets" role="radiogroup" aria-label="Chọn avatar">{avatarPresets.map((preset) => <button className={`avatar-preset ${draft.avatarPreset === preset.value ? "selected" : ""}`} type="button" role="radio" aria-checked={draft.avatarPreset === preset.value} aria-label={preset.label} key={preset.value} disabled={pending} onClick={() => setDraft((current) => ({ ...current, avatarPreset: preset.value }))}><AvatarGlyph preset={preset.value} /><small>{preset.label}</small></button>)}</div></div>
    <label>Username<input value={`@${user.username}`} readOnly aria-readonly="true" /></label>
    <label>Họ và tên<input value={draft.fullName} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))} required minLength={2} maxLength={50} /></label>
    <label>Tên hiển thị<input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} required minLength={2} maxLength={20} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <Button type="submit" pending={pending} disabled={!dirty}>{submitLabel}</Button>
  </form>;
}
