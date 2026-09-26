import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, PasswordField, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { changePassword, getMe, updateProfile, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { useTheme } from "../theme/useTheme";

type SettingsTab = "account" | "experience" | "privacy";

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const [user, setUser] = useState<UserProfile>();
  const [form, setForm] = useState({ fullName: "", displayName: "" });
  const [savedForm, setSavedForm] = useState({ fullName: "", displayName: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(() => localStorage.getItem("ottv2:profile-visibility") === "private" ? "private" : "public");
  const [sound, setSound] = useState(() => localStorage.getItem("ottv2:sound") !== "off");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("ottv2:reduced-motion") === "on");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getMe().then((result) => {
      setUser(result.user);
      const next = { fullName: result.user.fullName, displayName: result.user.displayName };
      setForm(next); setSavedForm(next); setTheme(result.user.theme);
    }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải cài đặt."));
  }, [setTheme]);

  const dirty = form.fullName !== savedForm.fullName || form.displayName !== savedForm.displayName || Boolean(password.currentPassword || password.newPassword || password.confirmPassword);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    try { const result = await updateProfile(form); setUser(result.user); setSavedForm(form); setMessage("Đã lưu hồ sơ."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu hồ sơ."); }
    finally { setPending(false); }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (password.newPassword !== password.confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setPending(true);
    try { await changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }); setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" }); setMessage("Đã đổi mật khẩu. Các phiên khác đã được đăng xuất."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đổi mật khẩu."); }
    finally { setPending(false); }
  };

  const saveTheme = async (theme: "light" | "dark" | "system") => {
    try { const result = await updateProfile({ theme }); setUser(result.user); setMessage("Đã lưu giao diện."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu giao diện."); }
  };

  const savePreference = (key: "sound" | "reduced-motion", value: boolean) => {
    if (key === "sound") { setSound(value); localStorage.setItem("ottv2:sound", value ? "on" : "off"); }
    else { setReducedMotion(value); localStorage.setItem("ottv2:reduced-motion", value ? "on" : "off"); document.documentElement.dataset.reducedMotion = value ? "true" : "false"; }
    setMessage("Đã lưu tuỳ chọn trải nghiệm.");
  };

  const savePrivacy = (value: "public" | "private") => { setProfileVisibility(value); localStorage.setItem("ottv2:profile-visibility", value); setMessage("Đã lưu quyền riêng tư."); };

  if (!user && error) return <section className="placeholder"><p className="eyebrow">PREFERENCES</p><h1>Cần đăng nhập</h1><p className="form-intro">{error}</p><Link className="button primary" to={routes.login}>Đăng nhập</Link></section>;

  const tabs: Array<{ id: SettingsTab; label: string }> = [{ id: "account", label: "Tài khoản" }, { id: "experience", label: "Trải nghiệm" }, { id: "privacy", label: "Riêng tư" }];
  return <section className="settings-layout"><div><p className="eyebrow">PREFERENCES / ACCOUNT</p><h1>Cài đặt</h1><p className="form-intro">Username <strong>{user?.username ?? "…"}</strong> là định danh bất biến.</p></div><div className="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">{tabs.map((tab) => <button className={`settings-tab ${activeTab === tab.id ? "active" : ""}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-panel-${tab.id}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="settings-grid">
    {activeTab === "account" && <form id="settings-panel-account" className="settings-card form-stack" onSubmit={saveProfile}><h2>Hồ sơ</h2><label>Họ và tên<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required minLength={2} maxLength={50} /></label><label>Tên hiển thị<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required minLength={2} maxLength={20} /></label><Button type="submit" pending={pending}>Lưu thay đổi</Button></form>}
    {activeTab === "experience" && <><div id="settings-panel-experience" className="settings-card"><h2>Giao diện</h2><p className="form-hint">Lựa chọn được đồng bộ vào hồ sơ để giữ trải nghiệm nhất quán.</p><ThemeSwitcher expanded onChange={saveTheme} /><label className="check-row"><input type="checkbox" checked={sound} onChange={(event) => savePreference("sound", event.target.checked)} /> Âm thanh giao diện</label><label className="check-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => savePreference("reduced-motion", event.target.checked)} /> Giảm chuyển động</label></div><form className="settings-card form-stack" onSubmit={savePassword}><h2>Bảo mật</h2><label>Mật khẩu hiện tại<input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required /></label><PasswordField label="Mật khẩu mới" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><PasswordField label="Xác nhận mật khẩu mới" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><Button type="submit" variant="secondary" pending={pending}>Đổi mật khẩu</Button></form></>}
    {activeTab === "privacy" && <div id="settings-panel-privacy" className="settings-card form-stack"><h2>Quyền riêng tư</h2><p className="form-hint">Kiểm soát việc người chơi khác có thể mở hồ sơ công khai của bạn.</p><label><span>Khả năng tìm thấy hồ sơ</span><select value={profileVisibility} onChange={(event) => savePrivacy(event.target.value as "public" | "private")}><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label><p className="form-hint">Thiết lập này áp dụng cho UI local v0.1; các API social đầy đủ sẽ được khóa ở Wave 8.</p></div>}
  </div>{dirty && <p className="form-hint unsaved-notice" role="status">Bạn có thay đổi chưa lưu. Rời trang có thể làm mất dữ liệu.</p>}{message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</section>;
}
