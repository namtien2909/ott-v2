import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button, PasswordField, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { register } from "../services/auth/authApi";
import { routes } from "../app/routes";

export default function RegisterPage() {
  const { notify } = useToast();
  const [form, setForm] = useState({ fullName: "", displayName: "", username: "", password: "", confirmPassword: "" });
  const [recoveryCode, setRecoveryCode] = useState(""); const [acknowledged, setAcknowledged] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [copied, setCopied] = useState(false); const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (form.password !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; } setPending(true); try { const result = await register({ fullName: form.fullName, displayName: form.displayName, username: form.username, password: form.password }); setRecoveryCode(result.recoveryCode); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể tạo tài khoản."); } finally { setPending(false); } };
  const copy = async () => { try { await navigator.clipboard?.writeText(recoveryCode); setCopied(true); notify("Đã sao chép mã khôi phục. Hãy lưu mã ở nơi an toàn.", "success"); } catch { notify("Không thể sao chép tự động. Hãy sao chép mã thủ công.", "warning"); } };
  if (recoveryCode) return <section className="auth-layout"><div className="auth-card recovery-card"><p className="eyebrow">RECOVERY / ONE-TIME</p><h1>Mã khôi phục</h1><p className="form-intro">Mã này chỉ hiển thị một lần. Hãy lưu ở nơi an toàn trước khi rời trang.</p><code className="recovery-code">{recoveryCode}</code><div className="home-actions"><Button variant="secondary" onClick={copy}>{copied ? "Đã sao chép" : "Sao chép mã"}</Button><label className="check-row recovery-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> Tôi đã lưu mã</label><Link className={`button primary ${acknowledged ? "" : "disabled-link"}`} aria-disabled={!acknowledged} onClick={(event) => { if (!acknowledged) event.preventDefault(); }} to={routes.profile}>Tôi đã lưu mã</Link></div><p className="form-hint">Không chia sẻ mã này với người khác.</p></div></section>;
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">AUTH / NEW PLAYER</p><h1>Tạo tài khoản</h1><p className="form-intro">Thiết lập hồ sơ trong vài giây. Username không thể đổi sau khi tạo.</p><form className="form-stack" onSubmit={submit}>
    <label>Họ và tên<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required minLength={2} maxLength={50} /></label>
    <label>Tên hiển thị<input value={form.displayName} onChange={(event) => update("displayName", event.target.value)} required minLength={2} maxLength={20} /></label>
    <label>Username<input value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" pattern="[A-Za-z0-9_]{4,20}" required minLength={4} maxLength={20} /></label>
    <PasswordField label="Mật khẩu" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" required minLength={8} hint="Tối thiểu 8 ký tự, nên dùng cả chữ và số." />
    <PasswordField label="Xác nhận mật khẩu" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} autoComplete="new-password" required minLength={8} />
    {error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" pending={pending} pendingLabel="Đang tạo tài khoản…">Đăng ký</Button>
  </form><div className="form-links"><span>Đã có tài khoản? <Link to={routes.login}>Đăng nhập</Link></span></div></div></section>;
}
