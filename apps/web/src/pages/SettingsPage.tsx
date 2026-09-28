import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BlockedUser } from "@ottv2/contracts";
import { Button, LoadingState, PasswordField, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { changePassword, getMe, updateProfile, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { useTheme } from "../theme/useTheme";
import { applyPresentationPreferences, BGM_KEY, BGM_VOLUME_KEY, COUNTDOWN_SOUND_KEY, MASTER_VOLUME_KEY, notifyAudioPreferenceChanged, readAudioPreference, SFX_KEY, SFX_VOLUME_KEY, SOUND_KEY } from "../services/presentation/preferences";
import { getBlockedUsers, unblockUser } from "../services/social/socialApi";
import { ProfileForm } from "../components/profile/ProfileForm";
import { applyQualityPreference, readQualityPreference, type QualityPreference } from "../foundation/qualityTier";

type SettingsTab = "account" | "appearance" | "audio" | "privacy" | "blocked";
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [{ id: "appearance", label: "Giao diện" }, { id: "audio", label: "Âm thanh" }, { id: "account", label: "Tài khoản" }, { id: "privacy", label: "Riêng tư" }, { id: "blocked", label: "Đã chặn" }];
const isSettingsTab = (value: string | null): value is SettingsTab => settingsTabs.some((tab) => tab.id === value);

function readBoolean(key: string, defaultValue: boolean): boolean {
  return localStorage.getItem(key) === null ? defaultValue : localStorage.getItem(key) !== "off";
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<UserProfile>();
  const [authResolved, setAuthResolved] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => isSettingsTab(searchParams.get("tab")) ? searchParams.get("tab") as SettingsTab : "account");
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(() => readQualityPreference());
  const [masterSound, setMasterSound] = useState(() => readBoolean(SOUND_KEY, true));
  const [sfxSound, setSfxSound] = useState(() => readBoolean(SFX_KEY, true));
  const [bgmSound, setBgmSound] = useState(() => readBoolean(BGM_KEY, false));
  const [countdownSound, setCountdownSound] = useState(() => readBoolean(COUNTDOWN_SOUND_KEY, true));
  const [masterVolume, setMasterVolume] = useState(() => readAudioPreference(MASTER_VOLUME_KEY, 100));
  const [sfxVolume, setSfxVolume] = useState(() => readAudioPreference(SFX_VOLUME_KEY, 55));
  const [bgmVolume, setBgmVolume] = useState(() => readAudioPreference(BGM_VOLUME_KEY, 30));
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("ottv2:reduced-motion") === "on");
  const [ambientMotion, setAmbientMotion] = useState(() => readBoolean("ottv2:ambient-motion", true));
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isSettingsTab(searchParams.get("tab"))) setActiveTab(searchParams.get("tab") as SettingsTab);
  }, [searchParams]);

  useEffect(() => {
    getMe().then((result) => {
      setUser(result.user);
      setTheme(result.user.theme);
    }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải cài đặt tài khoản.")).finally(() => setAuthResolved(true));
  }, [setTheme]);

  useEffect(() => {
    if (activeTab !== "blocked" || !user) return;
    setBlockedLoading(true);
    getBlockedUsers().then((result) => setBlockedUsers(result.users)).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải danh sách đã chặn.")).finally(() => setBlockedLoading(false));
  }, [activeTab, user]);

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const dirty = Boolean(password.currentPassword || password.newPassword || password.confirmPassword);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (password.newPassword !== password.confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setPending(true);
    try { await changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }); setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" }); setMessage("Đã đổi mật khẩu. Các phiên khác đã được đăng xuất."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đổi mật khẩu."); }
    finally { setPending(false); }
  };

  const saveTheme = async (theme: "light" | "dark" | "system") => {
    setError(""); setMessage("");
    if (!user) { setMessage("Đã lưu giao diện trên thiết bị này."); return; }
    try { const result = await updateProfile({ theme }); setUser(result.user); setMessage("Đã lưu giao diện."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đồng bộ giao diện; lựa chọn trên thiết bị vẫn được giữ."); }
  };
  const savePresenceVisibility = async (presenceVisibility: "FRIENDS" | "NOBODY") => {
    setError(""); setMessage(""); setPending(true);
    if (!user) { setPending(false); setMessage("Quyền hiện diện chỉ đồng bộ sau khi đăng nhập."); return; }
    try { const result = await updateProfile({ presenceVisibility }); setUser(result.user); setMessage("Đã lưu quyền riêng tư."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu quyền riêng tư."); }
    finally { setPending(false); }
  };

  const savePreference = (key: "reduced-motion" | "ambient-motion", value: boolean) => {
    if (key === "reduced-motion") { setReducedMotion(value); localStorage.setItem("ottv2:reduced-motion", value ? "on" : "off"); }
    else { setAmbientMotion(value); localStorage.setItem("ottv2:ambient-motion", value ? "on" : "off"); }
    applyPresentationPreferences();
    setMessage("Đã lưu tuỳ chọn trải nghiệm.");
  };

  const saveAudio = (key: "master" | "sfx" | "bgm" | "countdown" | "master-volume" | "sfx-volume" | "bgm-volume", value: boolean | number) => {
    if (key === "master") { setMasterSound(Boolean(value)); localStorage.setItem(SOUND_KEY, value ? "on" : "off"); }
    else if (key === "sfx") { setSfxSound(Boolean(value)); localStorage.setItem(SFX_KEY, value ? "on" : "off"); }
    else if (key === "bgm") { setBgmSound(Boolean(value)); localStorage.setItem(BGM_KEY, value ? "on" : "off"); }
    else if (key === "countdown") { setCountdownSound(Boolean(value)); localStorage.setItem(COUNTDOWN_SOUND_KEY, value ? "on" : "off"); }
    else if (key === "master-volume") { setMasterVolume(Number(value)); localStorage.setItem(MASTER_VOLUME_KEY, String(value)); }
    else if (key === "sfx-volume") { setSfxVolume(Number(value)); localStorage.setItem(SFX_VOLUME_KEY, String(value)); }
    else { setBgmVolume(Number(value)); localStorage.setItem(BGM_VOLUME_KEY, String(value)); }
    notifyAudioPreferenceChanged();
    setMessage("Đã lưu tuỳ chọn âm thanh.");
  };

  const removeBlock = async (blocked: BlockedUser) => {
    setError(""); setMessage(""); setPending(true);
    try { await unblockUser(blocked.userId); setBlockedUsers((users) => users.filter((user) => user.userId !== blocked.userId)); setMessage(`Đã bỏ chặn @${blocked.username}.`); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể bỏ chặn người chơi."); }
    finally { setPending(false); }
  };

  if (!authResolved) return <LoadingState fullPage label="Đang tải cài đặt…" />;

  return <section className="settings-layout"><div><p className="eyebrow">CÀI ĐẶT {user ? "TÀI KHOẢN" : "THIẾT BỊ"}</p><h1>Cài đặt</h1><p className="form-intro">{user ? <>Username <strong>{user.username}</strong> là định danh bất biến.</> : "Tuỳ chọn giao diện, hiệu năng và âm thanh được lưu trên thiết bị này."}</p></div><div className="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">{settingsTabs.map((tab) => <button className={`settings-tab ${activeTab === tab.id ? "active" : ""}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-panel-${tab.id}`} onClick={() => selectTab(tab.id)}>{tab.label}</button>)}</div><div className="settings-grid">
    {activeTab === "account" && <>{user ? <><div id="settings-panel-account" className="settings-card"><h2>Hồ sơ</h2><ProfileForm user={user} onSaved={(next) => { setUser(next); setMessage("Đã lưu hồ sơ."); }} /></div><form className="settings-card form-stack" onSubmit={savePassword}><h2>Đổi mật khẩu</h2><label>Mật khẩu hiện tại<input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required /></label><PasswordField label="Mật khẩu mới" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><PasswordField label="Nhập lại mật khẩu mới" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><Button type="submit" variant="secondary" pending={pending}>Đổi mật khẩu</Button></form></> : <div id="settings-panel-account" className="settings-card"><h2>Tài khoản</h2><p className="form-hint">Đăng nhập để chỉnh sửa hồ sơ, đổi mật khẩu và đồng bộ quyền riêng tư.</p><Link className="button primary" to={routes.login}>Đăng nhập</Link></div>}</>}
    {activeTab === "appearance" && <div id="settings-panel-appearance" className="settings-card form-stack"><h2>Giao diện & hiệu năng</h2><p className="form-hint">Thay đổi được áp dụng ngay và lưu trên thiết bị. Theme sẽ đồng bộ vào hồ sơ khi bạn đăng nhập.</p><ThemeSwitcher expanded onChange={saveTheme} /><label>Chất lượng hiệu ứng<select value={qualityPreference} onChange={(event) => { const next = event.target.value as QualityPreference; setQualityPreference(next); applyQualityPreference(next); setMessage("Đã áp dụng chất lượng hiển thị."); }}><option value="auto">Tự động</option><option value="high">Cao</option><option value="medium">Vừa</option><option value="low">Thấp</option></select></label><label className="check-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => savePreference("reduced-motion", event.target.checked)} /> Giảm chuyển động</label><label className="check-row"><input type="checkbox" checked={ambientMotion} onChange={(event) => savePreference("ambient-motion", event.target.checked)} /> Chuyển động nền</label></div>}
    {activeTab === "audio" && <div id="settings-panel-audio" className="settings-card form-stack"><h2>Âm thanh</h2><label className="check-row"><input type="checkbox" checked={masterSound} onChange={(event) => saveAudio("master", event.target.checked)} /> Master</label><label className="check-row"><input type="checkbox" checked={sfxSound} onChange={(event) => saveAudio("sfx", event.target.checked)} /> Hiệu ứng SFX</label><label className="check-row"><input type="checkbox" checked={bgmSound} onChange={(event) => saveAudio("bgm", event.target.checked)} /> Nhạc nền BGM</label><label className="check-row"><input type="checkbox" checked={countdownSound} onChange={(event) => saveAudio("countdown", event.target.checked)} /> Âm thanh đếm ngược</label><label>Âm lượng master <input type="range" min="0" max="100" value={masterVolume} onChange={(event) => saveAudio("master-volume", Number(event.target.value))} aria-valuetext={`${masterVolume}%`} /></label><label>Âm lượng SFX <input type="range" min="0" max="100" value={sfxVolume} onChange={(event) => saveAudio("sfx-volume", Number(event.target.value))} aria-valuetext={`${sfxVolume}%`} /></label><label>Âm lượng BGM <input type="range" min="0" max="100" value={bgmVolume} onChange={(event) => saveAudio("bgm-volume", Number(event.target.value))} aria-valuetext={`${bgmVolume}%`} /></label><p className="form-hint">Nếu trình duyệt chặn autoplay, âm thanh sẽ im lặng và không ảnh hưởng thao tác.</p></div>}
    {activeTab === "privacy" && <div id="settings-panel-privacy" className="settings-card form-stack"><h2>Quyền riêng tư</h2>{user ? <><label>Trạng thái hiện diện<select value={user.privacy.presenceVisibility} disabled={pending} onChange={(event) => void savePresenceVisibility(event.target.value as "FRIENDS" | "NOBODY")}><option value="FRIENDS">Chỉ bạn bè thấy</option><option value="NOBODY">Ẩn với mọi người</option></select></label><div><strong>Danh sách bạn bè</strong><p className="form-hint">Luôn riêng tư; không có endpoint công khai danh sách bạn bè.</p></div><div><strong>Họ và tên</strong><p className="form-hint">Luôn riêng tư; chỉ hồ sơ của chính bạn nhận được trường này.</p></div></> : <><p className="form-hint">Quyền hiện diện tài khoản cần đăng nhập; các tuỳ chọn thiết bị vẫn dùng được khi offline.</p><Link className="button secondary" to={routes.login}>Đăng nhập để đồng bộ</Link></>}</div>}
    {activeTab === "blocked" && <div id="settings-panel-blocked" className="settings-card form-stack"><h2>Người chơi đã chặn</h2>{user ? <><p className="form-hint">Người bị chặn không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn.</p>{blockedLoading ? <p className="form-hint">Đang tải danh sách…</p> : blockedUsers.length === 0 ? <p className="form-hint">Bạn chưa chặn người chơi nào.</p> : <div className="social-stack">{blockedUsers.map((blocked) => <div className="request-row" key={blocked.userId}><div className="avatar-mark small" aria-hidden="true">{blocked.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{blocked.displayName}</strong><span>@{blocked.username}</span><small>Đã chặn {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(blocked.blockedAt))}</small></div><Button variant="secondary" pending={pending} onClick={() => void removeBlock(blocked)}>Bỏ chặn</Button></div>)}</div>}</> : <><p className="form-hint">Đăng nhập để tải và quản lý danh sách đã chặn.</p><Link className="button secondary" to={routes.login}>Đăng nhập</Link></>}</div>}
  </div>{dirty && <p className="form-hint unsaved-notice" role="status">Bạn có thay đổi chưa lưu. Rời trang có thể làm mất dữ liệu.</p>}{message && <p className="form-success" role="status">{message}</p>}{error && !user && <p className="form-hint" role="status">Chế độ thiết bị đang hoạt động; cài đặt local vẫn khả dụng.</p>}{error && user && <p className="form-error" role="alert">{error}</p>}</section>;
}
