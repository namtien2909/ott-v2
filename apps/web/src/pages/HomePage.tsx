import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HealthResponse } from "@ottv2/contracts";
import { Button, LoadingState } from "../components/ui";
import { getHealth } from "../services/health/healthApi";
import { RoomBrowser } from "../components/rooms/RoomBrowser";
import { getMe, type UserProfile } from "../services/auth/authApi";
import { routes } from "../app/routes";

type HealthState = { kind: "loading" } | { kind: "ready"; data: HealthResponse } | { kind: "error" };

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [user, setUser] = useState<UserProfile | null>(null);
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
  useEffect(() => { getMe().then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy"><p className="eyebrow">NETWORK_READY / W9 LOCAL PLAY</p><h1>Oẳn Tù Tì <span>v2</span></h1><p>{user ? `Chào ${user.displayName}. Tìm đối thủ Ranked hoặc mở phòng Unranked theo ý bạn.` : "Nền tảng chiến thuật 9×9 — online khi cần, local khi muốn."}</p><div className="quick-actions"><Link className="quick-action primary" to={user ? routes.queue : routes.login}><span aria-hidden="true">⚔</span><strong>Chơi 1vs1 Online</strong><small>{user ? "Tìm trận Ranked ngay" : "Đăng nhập để chơi Ranked"}</small></Link><Link className="quick-action" to={routes.ai}><span aria-hidden="true">◉</span><strong>Chơi với máy</strong><small>AI Normal · không cần mạng</small></Link><Link className="quick-action" to={routes.offline}><span aria-hidden="true">⌁</span><strong>Chơi Offline</strong><small>Hai người trên một máy</small></Link><Link className="quick-action" to={routes.guest}><span aria-hidden="true">◌</span><strong>Chơi Guest</strong><small>Lưu lịch sử local</small></Link></div>{!user && <div className="guest-warning" role="status"><strong>Đang xem với tư cách khách</strong><span>Guest, AI và Offline không cần tài khoản; Ranked cần đăng nhập.</span><Link className="button secondary" to={routes.login}>Đăng nhập</Link></div>}</div><div className="hero-art" aria-hidden="true"><div className="hero-orb orb-blue" /><div className="hero-orb orb-red" /><div className="hero-symbol">✊<span>✌</span></div></div>
      </section>
      <div className="health-card" aria-live="polite">
        {health.kind === "loading" && <LoadingState label="Đang kiểm tra máy chủ…" />}
        {health.kind === "ready" && <><span className="status-dot success" /><strong>Máy chủ sẵn sàng</strong><small>{health.data.service} · {health.data.status}</small></>}
        {health.kind === "error" && <><span className="status-dot danger" /><strong>Không thể kết nối máy chủ</strong><Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Thử lại</Button></>}
      </div>
      <div className="home-actions"><Link className="button secondary" to="/phong/w1-demo">Xem bàn cờ W1</Link></div>
      <RoomBrowser />
    </div>
  );
}
