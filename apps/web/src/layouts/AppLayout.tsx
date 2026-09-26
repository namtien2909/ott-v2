import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button, Modal, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { getHealth } from "../services/health/healthApi";
import { getMe, logout, type UserProfile } from "../services/auth/authApi";

export function AppLayout() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<"checking" | "online" | "offline" | "reconnecting" | "degraded">("checking");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    let active = true;
    const check = () => getHealth().then((health) => { if (active) setNetwork(health.status === "ok" ? "online" : "degraded"); }).catch(() => { if (active) setNetwork("offline"); });
    check();
    const timer = window.setInterval(check, 30000);
    getMe().then((result) => { if (active) setUser(result.user); }).catch(() => { if (active) setUser(null); });
    const onNetworkState = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (!active) return;
      if (state === "OFFLINE") setNetwork("offline");
      else if (state === "RECONNECTING") setNetwork("reconnecting");
      else if (state === "DEGRADED") setNetwork("degraded");
      else if (state === "CONNECTED") setNetwork("online");
    };
    const onSessionExpired = () => { if (active) { setUser(null); setSessionExpired(true); } };
    window.addEventListener("ottv2:network-state", onNetworkState);
    window.addEventListener("ottv2:session-expired", onSessionExpired);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ottv2:network-state", onNetworkState);
      window.removeEventListener("ottv2:session-expired", onSessionExpired);
    };
  }, []);
  const signOut = async () => { await logout().catch(() => undefined); setUser(null); navigate(routes.login); };
  const networkLabel = network === "online" ? "Online" : network === "offline" ? "Offline" : network === "degraded" ? "Degraded" : network === "reconnecting" ? "Reconnecting" : "…";
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to={routes.home} aria-label="Oẳn Tù Tì v2 — Trang chủ">
          <span aria-hidden="true">✊</span><span>OTT</span><strong>v2</strong>
        </NavLink>
        <div className={`network-status ${network}`} aria-label={`Trạng thái mạng: ${network === "online" ? "đang hoạt động" : network === "offline" ? "ngoại tuyến" : network === "degraded" ? "suy giảm" : network === "reconnecting" ? "đang kết nối lại" : "đang kiểm tra"}`}><span className="status-dot" />{networkLabel}</div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <NavLink to={routes.history}>Lịch sử</NavLink>
          <NavLink to={routes.friends}>Bạn bè</NavLink>
          <NavLink to={routes.profile}>Hồ sơ</NavLink>
          <NavLink to={routes.settings}>Cài đặt</NavLink>
        </nav>
        <div className="header-actions"><ThemeSwitcher />{user ? <div className="session-menu"><span className="session-name">{user.displayName}</span><Button variant="ghost" onClick={signOut}>Đăng xuất</Button></div> : <NavLink className="header-login" to={routes.login}>Đăng nhập</NavLink>}</div>
      </header>
      {network !== "online" && network !== "checking" && <div className={`network-banner ${network}`} role="status" aria-live="polite"><strong>{network === "offline" ? "Mất kết nối mạng" : network === "degraded" ? "Dịch vụ đang suy giảm" : "Đang kết nối lại"}</strong><span>{network === "offline" ? "Các thao tác online đang tạm khoá; dữ liệu sẽ được đồng bộ khi kết nối trở lại." : network === "degraded" ? "Một số thao tác có thể chậm hoặc cần thử lại." : "Đang thử khôi phục kết nối realtime…"}</span></div>}
      <main className="page-container"><Outlet /></main>
      <Modal open={sessionExpired} title="Phiên đăng nhập đã hết hạn" description="Vui lòng đăng nhập lại để tiếp tục. Các thao tác đang chờ sẽ không được gửi lại tự động." dismissible={false} onClose={() => undefined}>
        <div className="modal-actions"><Button onClick={() => { setSessionExpired(false); navigate(routes.login); }}>Đăng nhập lại</Button></div>
      </Modal>
    </div>
  );
}
