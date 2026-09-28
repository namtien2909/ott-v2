import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BlockedUser } from "@ottv2/contracts";
import { Button, PasswordField, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { changePassword, getMe, updateProfile, type AvatarPreset, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { useTheme } from "../theme/useTheme";
import { applyPresentationPreferences } from "../services/presentation/preferences";
import { getBlockedUsers, unblockUser } from "../services/social/socialApi";

type SettingsTab = "account" | "appearance" | "audio" | "privacy" | "blocked";
const avatarPresets: Array<{ value: AvatarPreset; label: string; symbol: string }> = [{ value: "robot", label: "Robot", symbol: "◉" }, { value: "wolf", label: "Sói", symbol: "🐺" }, { value: "fox", label: "Cáo", symbol: "🦊" }, { value: "panda", label: "Gấu trúc", symbol: "🐼" }, { value: "arena", label: "Đấu trường", symbol: "⚔" }];

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const [user, setUser] = useState<UserProfile>();
  const [form, setForm] = useState({ fullName: "", displayName: "" });
  const [savedForm, setSavedForm] = useState({ fullName: "", displayName: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [sound, setSound] = useState(() => localStorage.getItem("ottv2:sound") !== "off");
  const [countdownSound, setCountdownSound] = useState(() => localStorage.getItem("ottv2:countdown-sound") !== "off");
  const [soundVolume, setSoundVolume] = useState(() => Number(localStorage.getItem("ottv2:sound-volume") ?? 55));
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("ottv2:reduced-motion") === "on");
  const [ambientMotion, setAmbientMotion] = useState(() => localStorage.getItem("ottv2:ambient-motion") !== "off");
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
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

  useEffect(() => {
    if (activeTab !== "blocked") return;
    setBlockedLoading(true);
    getBlockedUsers().then((result) => setBlockedUsers(result.users)).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải danh sách đã chặn.")).finally(() => setBlockedLoading(false));
  }, [activeTab]);

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

  const savePreference = (key: "sound" | "reduced-motion" | "ambient-motion", value: boolean) => {
    if (key === "sound") { setSound(value); localStorage.setItem("ottv2:sound", value ? "on" : "off"); }
    else if (key === "reduced-motion") { setReducedMotion(value); localStorage.setItem("ottv2:reduced-motion", value ? "on" : "off"); applyPresentationPreferences(); }
    else { setAmbientMotion(value); localStorage.setItem("ottv2:ambient-motion", value ? "on" : "off"); applyPresentationPreferences(); }
    setMessage("Đã lưu tuỳ chọn trải nghiệm.");
  };

  const saveAudio = (key: "countdown" | "volume", value: boolean | number) => {
    if (key === "countdown") { setCountdownSound(Boolean(value)); localStorage.setItem("ottv2:countdown-sound", value ? "on" : "off"); }
    else { setSoundVolume(Number(value)); localStorage.setItem("ottv2:sound-volume", String(value)); }
    setMessage("Đã lưu tuỳ chọn âm thanh.");
  };

  const removeBlock = async (blocked: BlockedUser) => {
    setError(""); setMessage(""); setPending(true);
    try { await unblockUser(blocked.userId); setBlockedUsers((users) => users.filter((user) => user.userId !== blocked.userId)); setMessage(`Đã bỏ chặn @${blocked.username}.`); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể bỏ chặn người chơi."); }
    finally { setPending(false); }
  };
  const saveAvatar = async (avatarPreset: AvatarPreset) => {
    setError(""); setMessage(""); setPending(true);
    try { const result = await updateProfile({ avatarPreset }); setUser(result.user); setMessage("Đã lưu avatar."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu avatar."); }
    finally { setPending(false); }
  };

  if (!user && error) return <section className="placeholder"><p className="eyebrow">CÀI ĐẶT</p><h1>Cần đăng nhập</h1><p className="form-intro">{error}</p><Link className="button primary" to={routes.login}>Đăng nhập</Link></section>;

  const tabs: Array<{ id: SettingsTab; label: string }> = [{ id: "appearance", label: "Giao diện" }, { id: "audio", label: "Âm thanh" }, { id: "account", label: "Tài khoản" }, { id: "privacy", label: "Riêng tư" }, { id: "blocked", label: "Đã chặn" }];
  return <section className="settings-layout"><div><p className="eyebrow">CÀI ĐẶT TÀI KHOẢN</p><h1>Cài đặt</h1><p className="form-intro">Username <strong>{user?.username ?? "…"}</strong> là định danh bất biến.</p></div><div className="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">{tabs.map((tab) => <button className={`settings-tab ${activeTab === tab.id ? "active" : ""}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-panel-${tab.id}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="settings-grid">
    {activeTab === "account" && <><form id="settings-panel-account" className="settings-card form-stack" onSubmit={saveProfile}><h2>Hồ sơ</h2><div><span className="form-hint">Avatar</span><div className="avatar-presets" role="radiogroup" aria-label="Chọn avatar">{avatarPresets.map((preset) => <button className={`avatar-preset ${user?.avatarPreset === preset.value ? "selected" : ""}`} type="button" role="radio" aria-checked={user?.avatarPreset === preset.value} aria-label={preset.label} key={preset.value} disabled={pending} onClick={() => void saveAvatar(preset.value)}><span aria-hidden="true">{preset.symbol}</span><small>{preset.label}</small></button>)}</div></div><label>Username<input value={`@${user?.username ?? ""}`} readOnly aria-readonly="true" /></label><label>Họ và tên<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required minLength={2} maxLength={50} /></label><label>Tên hiển thị<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required minLength={2} maxLength={20} /></label><Button type="submit" pending={pending}>Lưu thay đổi</Button></form><form className="settings-card form-stack" onSubmit={savePassword}><h2>Đổi mật khẩu</h2><label>Mật khẩu hiện tại<input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required /></label><PasswordField label="Mật khẩu mới" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><PasswordField label="Nhập lại mật khẩu mới" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><Button type="submit" variant="secondary" pending={pending}>Đổi mật khẩu</Button></form></>}
    {activeTab === "appearance" && <div id="settings-panel-appearance" className="settings-card"><h2>Giao diện</h2><p className="form-hint">Lựa chọn theme được đồng bộ vào hồ sơ của bạn.</p><ThemeSwitcher expanded onChange={saveTheme} /><label className="check-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => savePreference("reduced-motion", event.target.checked)} /> Giảm chuyển động</label><label className="check-row"><input type="checkbox" checked={ambientMotion} onChange={(event) => savePreference("ambient-motion", event.target.checked)} /> Chuyển động nền</label></div>}
    {activeTab === "audio" && <div id="settings-panel-audio" className="settings-card"><h2>Âm thanh</h2><label className="check-row"><input type="checkbox" checked={sound} onChange={(event) => savePreference("sound", event.target.checked)} /> Âm thanh giao diện</label><label className="check-row"><input type="checkbox" checked={countdownSound} onChange={(event) => saveAudio("countdown", event.target.checked)} /> Âm thanh đếm ngược</label><label>Âm lượng hiệu ứng <input type="range" min="0" max="100" value={soundVolume} onChange={(event) => saveAudio("volume", Number(event.target.value))} aria-valuetext={`${soundVolume}%`} /></label></div>}
    {activeTab === "privacy" && <div id="settings-panel-privacy" className="settings-card form-stack"><h2>Quyền riêng tư</h2><div><strong>Trạng thái hiện diện</strong><p className="form-hint">Chỉ bạn bè đã xác nhận mới thấy Online, Đang chơi hoặc Offline.</p></div><div><strong>Danh sách bạn bè</strong><p className="form-hint">Không công khai trên hồ sơ người chơi.</p></div><div><strong>Họ và tên</strong><p className="form-hint">Chỉ hiển thị trên hồ sơ của chính bạn.</p></div></div>}
    {activeTab === "blocked" && <div id="settings-panel-blocked" className="settings-card form-stack"><h2>Người chơi đã chặn</h2><p className="form-hint">Người bị chặn không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn.</p>{blockedLoading ? <p className="form-hint">Đang tải danh sách…</p> : blockedUsers.length === 0 ? <p className="form-hint">Bạn chưa chặn người chơi nào.</p> : <div className="social-stack">{blockedUsers.map((blocked) => <div className="request-row" key={blocked.userId}><div className="avatar-mark small" aria-hidden="true">{blocked.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{blocked.displayName}</strong><span>@{blocked.username}</span><small>Đã chặn {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(blocked.blockedAt))}</small></div><Button variant="secondary" pending={pending} onClick={() => void removeBlock(blocked)}>Bỏ chặn</Button></div>)}</div>}</div>}
  </div>{dirty && <p className="form-hint unsaved-notice" role="status">Bạn có thay đổi chưa lưu. Rời trang có thể làm mất dữ liệu.</p>}{message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</section>;
}
