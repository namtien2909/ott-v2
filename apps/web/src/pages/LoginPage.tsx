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
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError("");
    try { await login({ username, password, remember }); navigate(routes.profile); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đăng nhập."); }
    finally { setPending(false); }
  };
  return <section className="auth-layout"><div className="auth-card"><p className="eyebrow">AUTH / SESSION</p><h1>Chào mừng trở lại</h1><p className="form-intro">Đăng nhập để tiếp tục các ván đấu và lưu tiến trình của bạn.</p><form className="form-stack" onSubmit={submit}>
    <label>Tên đăng nhập<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required minLength={4} maxLength={20} /></label>
    <PasswordField label="Mật khẩu" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
    <label className="check-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ phiên đăng nhập</label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button type="submit" pending={pending} pendingLabel="Đang đăng nhập…">Đăng nhập</Button>
  </form><div className="form-links"><Link to={routes.forgotPassword}>Quên mật khẩu?</Link><span>Chưa có tài khoản? <Link to={routes.register}>Đăng ký</Link></span></div></div></section>;
}
