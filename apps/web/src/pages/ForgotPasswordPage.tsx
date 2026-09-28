import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, PasswordField } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { recover } from "../services/auth/authApi";
import { routes } from "../app/routes";

type RecoveryForm = { username: string; recoveryCode: string; newPassword: string; confirmPassword: string };
type RecoveryErrors = Partial<Record<keyof RecoveryForm, string>>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate(); const [form, setForm] = useState<RecoveryForm>({ username: "", recoveryCode: "", newPassword: "", confirmPassword: "" }); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState<RecoveryErrors>({}); const [done, setDone] = useState(false);
  const update = (key: keyof RecoveryForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); setFieldErrors((current) => ({ ...current, [key]: undefined })); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const nextErrors: RecoveryErrors = {};
    if (form.username.trim().length < 4) nextErrors.username = "Username cần ít nhất 4 ký tự.";
    if (!form.recoveryCode.trim()) nextErrors.recoveryCode = "Nhập recovery code đã lưu.";
    if (form.newPassword.length < 8) nextErrors.newPassword = "Mật khẩu mới cần ít nhất 8 ký tự.";
    if (form.newPassword !== form.confirmPassword) nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    setFieldErrors(nextErrors); if (Object.keys(nextErrors).length > 0) return; setPending(true);
    try { await recover({ username: form.username.trim(), recoveryCode: form.recoveryCode.trim().toUpperCase(), newPassword: form.newPassword }); setDone(true); window.setTimeout(() => navigate(routes.login), 800); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể khôi phục mật khẩu."); } finally { setPending(false); }
  };
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">KHÔI PHỤC / ĐẶT LẠI AN TOÀN</p><h1>Khôi phục mật khẩu</h1><p className="form-intro">Nhập username, mã khôi phục đã lưu và mật khẩu mới.</p><form className="form-stack" onSubmit={submit} noValidate>
    <label htmlFor="recover-username">Username<input id="recover-username" value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" required minLength={4} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "recover-username-error" : undefined} />{fieldErrors.username && <small id="recover-username-error" className="field-error">{fieldErrors.username}</small>}</label>
    <label htmlFor="recover-code">Recovery Code<input id="recover-code" value={form.recoveryCode} onChange={(event) => update("recoveryCode", event.target.value.toUpperCase())} required autoCapitalize="characters" spellCheck={false} aria-invalid={Boolean(fieldErrors.recoveryCode)} aria-describedby={fieldErrors.recoveryCode ? "recover-code-error" : undefined} />{fieldErrors.recoveryCode && <small id="recover-code-error" className="field-error">{fieldErrors.recoveryCode}</small>}</label>
    <PasswordField id="recover-new-password" label="Mật khẩu mới" value={form.newPassword} onChange={(event) => update("newPassword", event.target.value)} required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.newPassword)} />
    {fieldErrors.newPassword && <p className="field-error" role="status">{fieldErrors.newPassword}</p>}
    <PasswordField id="recover-confirm-password" label="Xác nhận mật khẩu mới" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirmPassword)} />
    {fieldErrors.confirmPassword && <p className="field-error" role="status">{fieldErrors.confirmPassword}</p>}
    {error && <p className="form-error" role="alert" aria-live="assertive">{error}</p>}{done && <p className="form-success" role="status" aria-live="polite">Đã đổi mật khẩu. Đang chuyển tới đăng nhập…</p>}<Button type="submit" pending={pending} pendingLabel="Đang khôi phục…">Đặt lại mật khẩu</Button>
  </form><div className="form-links"><Link to={routes.login}>Quay lại đăng nhập</Link></div></div></section>;
}
