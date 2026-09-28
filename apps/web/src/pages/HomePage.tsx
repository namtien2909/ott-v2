import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { HealthResponse } from "@ottv2/contracts";
import { Button, LoadingState } from "../components/ui";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { RoomBrowser } from "../components/rooms/RoomBrowser";
import { FriendsPreview } from "../components/social/FriendsPreview";
import { getMe, type UserProfile } from "../services/auth/authApi";
import { routes } from "../app/routes";
import { getRankForElo } from "../foundation/rankConfig";

type HealthState = { kind: "loading" } | { kind: "ready"; data: HealthResponse } | { kind: "error" };
type AuthState = { kind: "loading" } | { kind: "guest" } | { kind: "authenticated"; user: UserProfile };

function AvatarFrame({ displayName, preset, size = "default" }: { displayName: string; preset?: UserProfile["avatarPreset"]; size?: "default" | "small" }) {
  return <span className={`home-avatar home-avatar-${size} avatar-preset-${preset ?? "guest"}`} aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>;
}

function canUsePointerMotion(event: PointerEvent<HTMLElement>) {
  return event.pointerType !== "touch" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function resetPointerMotion(element: HTMLElement) {
  element.dataset.pointerActive = "false";
  element.style.setProperty("--b3-tilt-x", "0deg");
  element.style.setProperty("--b3-tilt-y", "0deg");
  element.style.setProperty("--b3-spot-x", "50%");
  element.style.setProperty("--b3-spot-y", "50%");
  element.style.setProperty("--b3-magnetic-x", "0px");
  element.style.setProperty("--b3-magnetic-y", "0px");
}

function PointerSurface({ className, children }: { className: string; children: ReactNode }) {
  const surfaceRef = useRef<HTMLElement>(null);
  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const element = surfaceRef.current;
    if (!element || !canUsePointerMotion(event)) return;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    element.dataset.pointerActive = "true";
    element.style.setProperty("--b3-tilt-x", `${(x - 0.5) * 12}deg`);
    element.style.setProperty("--b3-tilt-y", `${(0.5 - y) * 12}deg`);
    element.style.setProperty("--b3-spot-x", `${x * 100}%`);
    element.style.setProperty("--b3-spot-y", `${y * 100}%`);
  };
  const handlePointerLeave = () => { if (surfaceRef.current) resetPointerMotion(surfaceRef.current); };
  return <section ref={surfaceRef} className={`b3-pointer-surface ${className}`} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>{children}</section>;
}

function MagneticLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const element = linkRef.current;
    if (!element || !canUsePointerMotion(event)) return;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    element.dataset.pointerActive = "true";
    element.style.setProperty("--b3-magnetic-x", `${(x - 0.5) * 16}px`);
    element.style.setProperty("--b3-magnetic-y", `${(y - 0.5) * 16}px`);
  };
  const handlePointerLeave = () => { if (linkRef.current) resetPointerMotion(linkRef.current); };
  return <Link ref={linkRef} className={className} to={to} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>{children}</Link>;
}

function ProfilePanel({ state }: { state: AuthState }) {
  if (state.kind === "loading") return <aside className="home-panel home-profile-panel" aria-label="Hồ sơ người chơi" aria-busy="true"><LoadingState label="Đang tải hồ sơ…" /></aside>;
  if (state.kind === "guest") return <aside className="home-panel home-profile-panel home-profile-guest" aria-label="Hồ sơ người chơi"><p className="eyebrow">PLAYER PROFILE</p><AvatarFrame displayName="Guest" /><h2>Khách đấu trường</h2><p>Đăng nhập để mở hồ sơ, nhận rank badge và lưu Elo Ranked.</p><Link className="button primary home-profile-cta" to={routes.login}>ĐĂNG NHẬP ĐỂ XẾP HẠNG</Link><span className="home-profile-note">Guest history chỉ lưu trên thiết bị này.</span></aside>;

  const { user } = state;
  const rank = getRankForElo(user.stats.elo);
  return <aside className="home-panel home-profile-panel" aria-label="Hồ sơ người chơi"><div className="home-panel-heading"><p className="eyebrow">PLAYER PROFILE</p><Link className="home-panel-link" to={routes.profile}>Xem hồ sơ</Link></div><div className="home-profile-identity"><AvatarFrame displayName={user.displayName} preset={user.avatarPreset} /><div><h2>{user.displayName}</h2><p>@{user.username}</p></div></div><div className={`rank-badge rank-${rank.color}`} aria-label={`Rank ${rank.name}`}><span className="rank-shield" aria-hidden="true">◆</span><span><strong>{rank.name}</strong><small>RANKED TIER</small></span></div><dl className="home-profile-stats"><div><dt>ELO</dt><dd>{user.stats.elo}</dd></div><div><dt>W</dt><dd>{user.stats.rankedWins}</dd></div><div><dt>L</dt><dd>{user.stats.rankedLosses}</dd></div></dl><Link className="button secondary home-profile-cta" to={routes.profile}>Mở dossier</Link></aside>;
}

function ModeCard({ to, label, title, copy, className = "" }: { to: string; label: string; title: string; copy: string; className?: string }) {
  return <Link className={`home-mode-card ${className}`} to={to}><span className="home-mode-mark" aria-hidden="true">{label.slice(0, 1)}</span><span><strong>{title}</strong><small>{copy}</small></span><span className="home-mode-arrow" aria-hidden="true">→</span></Link>;
}

function SystemPulse({ health, onRetry }: { health: HealthState; onRetry: () => void }) {
  return <div className="home-server-strip" aria-live="polite"><span className={`status-dot ${health.kind === "ready" && isCoreServiceReady(health.data) ? "success" : health.kind === "error" ? "danger" : "warning"}`} /><span className="home-server-label">SYSTEM-PULSE</span>{health.kind === "loading" && <span>Đang kiểm tra máy chủ…</span>}{health.kind === "ready" && <><strong>{isCoreServiceReady(health.data) ? "ONLINE" : "DEGRADED"}</strong><span>{isCoreServiceReady(health.data) ? "API · Database · Realtime" : "Một số dịch vụ đang suy giảm"}</span></>}{health.kind === "error" && <><strong>OFFLINE</strong><span>Không thể kết nối máy chủ</span><Button variant="ghost" onClick={onRetry}>Thử lại</Button></>}</div>;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setHealth({ kind: "loading" });
    getHealth(controller.signal)
      .then((data) => setHealth({ kind: "ready", data }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setHealth({ kind: "error" });
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { let active = true; getMe().then((result) => { if (active) setAuth({ kind: "authenticated", user: result.user }); }).catch(() => { if (active) setAuth({ kind: "guest" }); }); return () => { active = false; }; }, []);

  const user = auth.kind === "authenticated" ? auth.user : undefined;
  return <div className="home-page home-lobby-page"><div className="home-lobby-grid"><ProfilePanel state={auth} /><section className="home-lobby-center" aria-label="Khu vực sảnh chính"><PointerSurface className="home-hero home-lobby-hero"><div className="home-hero-copy"><p className="eyebrow">NEON ESPORTS ARENA · 9×9</p><h1>Đọc vị.<br /><span>Chiếm bàn.</span></h1><p>{user ? `Chào ${user.displayName}. Sẵn sàng tìm đối thủ Ranked?` : "Chiến thuật oẳn tù tì online khi cần, local khi muốn."}</p><MagneticLink className="home-primary-cta" to={user ? routes.queue : routes.login}><span className="home-cta-pulse" aria-hidden="true" /><strong>{user ? "TÌM TRẬN RANKED" : "ĐĂNG NHẬP ĐỂ XẾP HẠNG"}</strong><small>{user ? "Ghép đối thủ theo Elo" : "Mở hồ sơ và lưu tiến trình"}</small><span aria-hidden="true">→</span></MagneticLink></div><div className="hero-art" aria-hidden="true"><div className="hero-orb orb-blue" /><div className="hero-orb orb-red" /><div className="hero-symbol">✊<span>✌</span></div></div></PointerSurface><section className="home-mode-section" aria-labelledby="home-modes-title"><div className="home-section-heading"><div><p className="eyebrow">QUICK DEPLOY</p><h2 id="home-modes-title">Chọn mode</h2></div><span className="home-shortcut">Không cần hover</span></div><div className="home-mode-grid"><ModeCard to={routes.ai} label="AI" title="Đấu với máy" copy="AI Normal · luyện đọc thế cờ" className="mode-ai" /><ModeCard to={routes.offline} label="OF" title="Offline 2P" copy="Hai người · một thiết bị" className="mode-offline" /><ModeCard to={routes.guest} label="GU" title="Guest Arena" copy="Lưu local · không cần tài khoản" className="mode-guest" /></div></section><SystemPulse health={health} onRetry={() => setAttempt((value) => value + 1)} />{auth.kind === "guest" && <div className="guest-warning home-guest-invite" role="status"><strong>Đang xem với tư cách khách</strong><span>Lịch sử Guest chỉ lưu trên thiết bị này.</span><Link className="button secondary" to={routes.login}>Tạo tài khoản</Link></div>}</section><aside className="home-lobby-right" aria-label="Phòng đấu và bạn bè"><RoomBrowser /><FriendsPreview authState={auth.kind} /></aside></div></div>;
}
