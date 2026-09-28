import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button, PasswordField, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { register } from "../services/auth/authApi";
import { routes } from "../app/routes";

type RegisterForm = { fullName: string; displayName: string; username: string; password: string; confirmPassword: string };
type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

export default function RegisterPage() {
  const { notify } = useToast();
  const [form, setForm] = useState<RegisterForm>({ fullName: "", displayName: "", username: "", password: "", confirmPassword: "" });
  const [recoveryCode, setRecoveryCode] = useState(""); const [acknowledged, setAcknowledged] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({}); const [copied, setCopied] = useState(false); const update = (key: keyof RegisterForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); setFieldErrors((current) => ({ ...current, [key]: undefined })); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const nextErrors: RegisterErrors = {};
    if (form.fullName.trim().length < 2) nextErrors.fullName = "Họ và tên cần ít nhất 2 ký tự.";
    if (form.displayName.trim().length < 2) nextErrors.displayName = "Tên hiển thị cần ít nhất 2 ký tự.";
    if (!/^[A-Za-z0-9_]{4,20}$/.test(form.username)) nextErrors.username = "Username gồm 4–20 ký tự chữ, số hoặc dấu gạch dưới.";
    if (form.password.length < 8) nextErrors.password = "Mật khẩu cần ít nhất 8 ký tự.";
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    setFieldErrors(nextErrors); if (Object.keys(nextErrors).length > 0) return; setPending(true);
    try { const result = await register({ fullName: form.fullName.trim(), displayName: form.displayName.trim(), username: form.username, password: form.password }); setRecoveryCode(result.recoveryCode); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể tạo tài khoản."); } finally { setPending(false); }
  };
  const copy = async () => { try { await navigator.clipboard?.writeText(recoveryCode); setCopied(true); notify("Đã sao chép mã khôi phục. Hãy lưu mã ở nơi an toàn.", "success"); } catch { notify("Không thể sao chép tự động. Hãy bôi đen và sao chép mã thủ công.", "warning"); } };
  if (recoveryCode) return <section className="auth-layout"><div className="auth-card recovery-card" role="status" aria-live="polite"><p className="eyebrow">KHÔI PHỤC / DÙNG MỘT LẦN</p><h1>Mã khôi phục</h1><p className="form-intro">Mã này chỉ hiển thị một lần trong phiên này. Hãy lưu ở nơi an toàn trước khi rời trang.</p><div className="recovery-hologram"><span className="recovery-label">RECOVERY CODE</span><code className="recovery-code">{recoveryCode}</code><span className="recovery-scanline" aria-hidden="true" /></div><div className="home-actions recovery-actions"><Button variant="secondary" onClick={copy}>{copied ? "Đã sao chép" : "Sao chép mã"}</Button><label className="check-row recovery-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> Tôi đã lưu mã</label><Link className={`button primary ${acknowledged ? "" : "disabled-link"}`} aria-disabled={!acknowledged} tabIndex={acknowledged ? 0 : -1} onClick={(event) => { if (!acknowledged) event.preventDefault(); }} to={routes.profile}>Tôi đã lưu mã</Link></div><p className="form-hint">Không chia sẻ mã này với người khác. Nếu clipboard bị chặn, hãy sao chép thủ công từ khung mã.</p></div></section>;
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">XÁC THỰC / NGƯỜI CHƠI MỚI</p><h1>Tạo tài khoản</h1><p className="form-intro">Thiết lập hồ sơ trong vài giây. Username không thể đổi sau khi tạo.</p><form className="form-stack" onSubmit={submit} noValidate>
    <label htmlFor="register-full-name">Họ và tên<input id="register-full-name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} autoComplete="name" required minLength={2} maxLength={50} aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? "register-full-name-error" : undefined} />{fieldErrors.fullName && <small id="register-full-name-error" className="field-error">{fieldErrors.fullName}</small>}</label>
    <label htmlFor="register-display-name">Tên hiển thị<input id="register-display-name" value={form.displayName} onChange={(event) => update("displayName", event.target.value)} required minLength={2} maxLength={20} aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? "register-display-name-error" : undefined} />{fieldErrors.displayName && <small id="register-display-name-error" className="field-error">{fieldErrors.displayName}</small>}</label>
    <label htmlFor="register-username">Username<input id="register-username" value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" pattern="[A-Za-z0-9_]{4,20}" required minLength={4} maxLength={20} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "register-username-error" : undefined} />{fieldErrors.username && <small id="register-username-error" className="field-error">{fieldErrors.username}</small>}</label>
    <PasswordField id="register-password" label="Mật khẩu" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" required minLength={8} hint="Tối thiểu 8 ký tự, nên dùng cả chữ và số." aria-invalid={Boolean(fieldErrors.password)} />
    {fieldErrors.password && <p className="field-error" role="status">{fieldErrors.password}</p>}
    <PasswordField id="register-confirm-password" label="Xác nhận mật khẩu" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} autoComplete="new-password" required minLength={8} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "register-confirm-password-error" : undefined} />
    {fieldErrors.confirmPassword && <p id="register-confirm-password-error" className="field-error" role="status">{fieldErrors.confirmPassword}</p>}
    {error && <p className="form-error" role="alert" aria-live="assertive">{error}</p>}<Button type="submit" pending={pending} pendingLabel="Đang tạo tài khoản…">Đăng ký</Button>
  </form><div className="form-links"><span>Đã có tài khoản? <Link to={routes.login}>Đăng nhập</Link></span></div></div></section>;
}
