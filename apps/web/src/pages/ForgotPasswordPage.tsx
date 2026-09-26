import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, PasswordField } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { recover } from "../services/auth/authApi";
import { routes } from "../app/routes";

export default function ForgotPasswordPage() {
  const navigate = useNavigate(); const [form, setForm] = useState({ username: "", recoveryCode: "", newPassword: "", confirmPassword: "" }); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (form.newPassword !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; } setPending(true); try { await recover({ username: form.username, recoveryCode: form.recoveryCode, newPassword: form.newPassword }); setDone(true); window.setTimeout(() => navigate(routes.login), 800); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể khôi phục mật khẩu."); } finally { setPending(false); } };
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">RECOVERY / SECURE RESET</p><h1>Khôi phục mật khẩu</h1><p className="form-intro">Nhập username, Recovery Code đã lưu và mật khẩu mới.</p><form className="form-stack" onSubmit={submit}>
    <label>Username<input value={form.username} onChange={(event) => update("username", event.target.value)} required minLength={4} /></label><label>Recovery Code<input value={form.recoveryCode} onChange={(event) => update("recoveryCode", event.target.value)} required autoCapitalize="characters" /></label><PasswordField label="Mật khẩu mới" value={form.newPassword} onChange={(event) => update("newPassword", event.target.value)} required minLength={8} autoComplete="new-password" /><PasswordField label="Xác nhận mật khẩu mới" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} required minLength={8} autoComplete="new-password" />
    {error && <p className="form-error" role="alert">{error}</p>}{done && <p className="form-success" role="status">Đã đổi mật khẩu. Đang chuyển tới đăng nhập…</p>}<Button type="submit" pending={pending} pendingLabel="Đang khôi phục…">Đặt lại mật khẩu</Button>
  </form><div className="form-links"><Link to={routes.login}>Quay lại đăng nhập</Link></div></div></section>;
}
