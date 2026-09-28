import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HealthResponse } from "@ottv2/contracts";
import { Button, LoadingState } from "../components/ui";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { RoomBrowser } from "../components/rooms/RoomBrowser";
import { getMe, type UserProfile } from "../services/auth/authApi";
import { routes } from "../app/routes";
import { FriendsPreview } from "../components/social/FriendsPreview";

type HealthState = { kind: "loading" } | { kind: "ready"; data: HealthResponse } | { kind: "error" };

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
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
  useEffect(() => { getMe().then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setAuthResolved(true)); }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy"><p className="eyebrow">ĐẤU TRÍ · ĐỌC VỊ · CHIẾM BÀN</p><h1>Oẳn Tù Tì <span>v2</span></h1><p>{user ? `Chào ${user.displayName}. Tìm đối thủ xếp hạng hoặc mở phòng thường theo ý bạn.` : "Nền tảng chiến thuật 9×9 — online khi cần, local khi muốn."}</p><div className="quick-actions"><Link className="quick-action primary" to={user ? routes.queue : routes.login}><span aria-hidden="true">⚔</span><strong>Chơi 1vs1 Online</strong><small>{user ? "Tìm trận xếp hạng ngay" : "Đăng nhập để chơi xếp hạng"}</small></Link><Link className="quick-action" to={routes.ai}><span aria-hidden="true">◉</span><strong>Chơi với máy</strong><small>Bot bình thường · không cần mạng</small></Link><Link className="quick-action" to={routes.offline}><span aria-hidden="true">⌁</span><strong>Chơi ngoại tuyến</strong><small>Hai người trên một máy</small></Link><Link className="quick-action" to={routes.guest}><span aria-hidden="true">◌</span><strong>Chơi khách</strong><small>Lưu lịch sử trên thiết bị</small></Link></div>{!user && <div className="guest-warning" role="status"><strong>Đang xem với tư cách khách</strong><span>Lịch sử của khách chỉ lưu trên thiết bị này. Tạo tài khoản để lưu tiến trình.</span><Link className="button secondary" to={routes.login}>Đăng nhập</Link></div>}</div><div className="hero-art" aria-hidden="true"><div className="hero-orb orb-blue" /><div className="hero-orb orb-red" /><div className="hero-symbol">✊<span>✌</span></div></div>
      </section>
      <div className="health-card" aria-live="polite">
        {health.kind === "loading" && <LoadingState label="Đang kiểm tra máy chủ…" />}
        {health.kind === "ready" && <><span className={`status-dot ${isCoreServiceReady(health.data) ? "success" : "danger"}`} /><strong>{isCoreServiceReady(health.data) ? "Máy chủ sẵn sàng" : "Dịch vụ đang suy giảm"}</strong><small>{isCoreServiceReady(health.data) && health.data.components.realtime.status !== "ok" ? "API + Database OK · Realtime chưa cấu hình" : `${health.data.service} · ${health.data.status}`}</small></>}
        {health.kind === "error" && <><span className="status-dot danger" /><strong>Không thể kết nối máy chủ</strong><Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Thử lại</Button></>}
      </div>

      <RoomBrowser />
      {authResolved && user && <FriendsPreview />}
    </div>
  );
}
