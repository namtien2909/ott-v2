import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../components/ui";
import { getMe, getPublicProfile, type PublicProfile, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { routes } from "../app/routes";
import { useParams } from "react-router-dom";

export default function ProfilePage() {
  const { username } = useParams<{ username?: string }>();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; profile: UserProfile | PublicProfile; isSelf: boolean } | { kind: "error"; message: string }>({ kind: "loading" });
  useEffect(() => { setState({ kind: "loading" }); const request = username ? getPublicProfile(username).then((result) => ({ profile: result.profile, isSelf: false })) : getMe().then((result) => ({ profile: result.user, isSelf: true })); request.then((result) => setState({ kind: "ready", ...result })).catch((reason) => setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải hồ sơ." })); }, [username]);
  if (state.kind === "loading") return <LoadingState fullPage label="Đang tải hồ sơ…" />;
  if (state.kind === "error") return <section className="placeholder"><p className="eyebrow">PLAYER_PROFILE</p><h1>Cần đăng nhập</h1><p className="form-intro">{state.message}</p><Link className="button primary" to={routes.login}>Đăng nhập</Link></section>;
  const { profile, isSelf } = state;
  return <section className="profile-layout"><div className="profile-hero"><div className="avatar-mark" aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">PLAYER_PROFILE / {isSelf ? "SELF" : "PUBLIC"}</p><h1>{profile.displayName}</h1><p className="profile-handle">@{profile.username}{isSelf && " · " + (profile as UserProfile).fullName}</p></div>{isSelf && <Link className="button secondary" to={routes.settings}>Cài đặt</Link>}</div><div className="stats-grid"><div className="stat-card"><span>ELO</span><strong>{profile.stats.elo}</strong><small>Ranked rating</small></div><div className="stat-card"><span>RANKED</span><strong>{profile.stats.rankedWins}–{profile.stats.rankedLosses}</strong><small>Thắng – thua</small></div><div className="stat-card"><span>QUICK MATCH</span><strong>{profile.stats.quickWins}–{profile.stats.quickLosses}</strong><small>Thắng – thua</small></div></div><div className="profile-note"><strong>{isSelf ? "Hồ sơ sẵn sàng" : "Hồ sơ công khai"}</strong><span>Thống kê trận đấu sẽ xuất hiện khi các wave Match/History hoàn thành.</span></div></section>;
}
