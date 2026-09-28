import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, PasswordField } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { login } from "../services/auth/authApi";
import { routes } from "../app/routes";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError("");
    const nextErrors: typeof fieldErrors = {};
    if (username.trim().length < 4) nextErrors.username = "Username cần ít nhất 4 ký tự.";
    if (!password) nextErrors.password = "Vui lòng nhập mật khẩu.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) { setPending(false); return; }
    try { await login({ username: username.trim(), password, remember }); navigate(routes.profile); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đăng nhập."); }
    finally { setPending(false); }
  };
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">AUTH / SESSION</p><h1>Chào mừng trở lại</h1><p className="form-intro">Đăng nhập để tiếp tục các ván đấu và lưu tiến trình của bạn.</p><form className="form-stack" onSubmit={submit}>
    <label htmlFor="login-username">Tên đăng nhập<input id="login-username" value={username} onChange={(event) => { setUsername(event.target.value); setFieldErrors((current) => ({ ...current, username: undefined })); }} autoComplete="username" required minLength={4} maxLength={20} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "login-username-error" : undefined} />{fieldErrors.username && <small id="login-username-error" className="field-error">{fieldErrors.username}</small>}</label>
    <PasswordField id="login-password" label="Mật khẩu" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }} autoComplete="current-password" required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} />
    {fieldErrors.password && <p id="login-password-error" className="field-error" role="status">{fieldErrors.password}</p>}
    <label className="check-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ phiên đăng nhập</label>
    {error && <p className="form-error" role="alert" aria-live="assertive">{error}</p>}
    <Button type="submit" pending={pending} pendingLabel="Đang đăng nhập…">Đăng nhập</Button>
  </form><div className="form-links"><Link to={routes.forgotPassword}>Quên mật khẩu?</Link><span>Chưa có tài khoản? <Link to={routes.register}>Đăng ký</Link></span></div></div></section>;
}
