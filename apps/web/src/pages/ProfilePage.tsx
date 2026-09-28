import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../components/ui";
import { getMe, getPublicProfile, type AvatarPreset, type PublicProfile, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { routes } from "../app/routes";
import { useParams } from "react-router-dom";

export default function ProfilePage() {
  const { username } = useParams<{ username?: string }>();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; profile: UserProfile | PublicProfile; isSelf: boolean } | { kind: "error"; message: string }>({ kind: "loading" });
  useEffect(() => { setState({ kind: "loading" }); const request = username ? getPublicProfile(username).then((result) => ({ profile: result.profile, isSelf: false })) : getMe().then((result) => ({ profile: result.user, isSelf: true })); request.then((result) => setState({ kind: "ready", ...result })).catch((reason) => setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải hồ sơ." })); }, [username]);
  if (state.kind === "loading") return <LoadingState fullPage label="Đang tải hồ sơ…" />;
  if (state.kind === "error") return <section className="placeholder"><p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p><h1>Cần đăng nhập</h1><p className="form-intro">{state.message}</p><Link className="button primary" to={routes.login}>Đăng nhập</Link></section>;
  const { profile, isSelf } = state;
  const rankedGames = profile.stats.rankedWins + profile.stats.rankedLosses;
  const winRate = rankedGames === 0 ? 0 : Math.round((profile.stats.rankedWins / rankedGames) * 1000) / 10;
  return <section className="profile-layout"><div className="profile-hero"><div className="avatar-mark" aria-label={`Avatar ${profile.displayName}`}>{avatarSymbol(profile.avatarPreset)}</div><div><p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p><h1>{profile.displayName}</h1><p className="profile-handle">@{profile.username}{isSelf && " · " + (profile as UserProfile).fullName}</p></div>{isSelf && <Link className="button secondary" to={routes.settings}>Chỉnh sửa hồ sơ</Link>}</div><div className="stats-grid profile-stats"><div className="stat-card"><span>RATING</span><strong>{profile.stats.elo}</strong><small>Điểm xếp hạng</small></div><div className="stat-card"><span>RANKED</span><strong>{rankedGames}</strong><small>Trận xếp hạng</small></div><div className="stat-card"><span>THẮNG</span><strong>{profile.stats.rankedWins}</strong><small>Ranked</small></div><div className="stat-card"><span>THUA</span><strong>{profile.stats.rankedLosses}</strong><small>Ranked</small></div><div className="stat-card"><span>WIN RATE</span><strong>{winRate}%</strong><small>Ranked</small></div></div><div className="profile-note"><strong>{isSelf ? "Hồ sơ sẵn sàng" : "Hồ sơ công khai"}</strong><span>Theo dõi phong độ, lịch sử đấu và kết nối của bạn.</span></div></section>;
}

function avatarSymbol(preset: AvatarPreset): string { return ({ robot: "◉", wolf: "🐺", fox: "🦊", panda: "🐼", arena: "⚔" } as const)[preset]; }
