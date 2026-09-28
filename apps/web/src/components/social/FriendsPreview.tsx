import { useEffect, useState } from "react";
import type { PresenceEvent, SocialUser } from "@ottv2/contracts";
import { Link } from "react-router-dom";
import { Button, LoadingState } from "../ui";
import { getFriends, subscribeToPresence } from "../../services/social/socialApi";
import { routes } from "../../app/routes";
import { ApiError } from "../../services/http/apiError";

type AuthState = "loading" | "guest" | "authenticated";
type PreviewState = { kind: "loading" } | { kind: "ready"; friends: SocialUser[] } | { kind: "error"; message: string };

function presenceLabel(presence: SocialUser["presence"]) {
  return presence === "ONLINE" ? "Online" : presence === "IN_GAME" ? "Đang đấu" : "Offline";
}

export function FriendsPreview({ authState }: { authState: AuthState }) {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });

  const load = () => {
    setState({ kind: "loading" });
    getFriends().then(({ friends }) => setState({ kind: "ready", friends })).catch((reason: unknown) => setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải friends preview." }));
  };

  useEffect(() => {
    if (authState !== "authenticated") return;
    let active = true;
    getFriends().then(({ friends }) => { if (active) setState({ kind: "ready", friends }); }).catch((reason: unknown) => { if (active) setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải friends preview." }); });
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = subscribeToPresence((event: PresenceEvent) => setState((current) => current.kind === "ready" ? { ...current, friends: current.friends.map((friend) => friend.userId === event.user.userId ? { ...friend, presence: event.user.presence } : friend) } : current), () => undefined);
    } catch {
      // Presence is an enhancement; the last successful friend snapshot remains usable.
    }
    return () => { active = false; unsubscribe(); };
  }, [authState]);

  if (authState === "loading") return <section className="home-panel friends-preview" aria-busy="true"><div className="home-panel-heading"><p className="eyebrow">FRIENDS PREVIEW</p></div><LoadingState label="Đang xác thực…" /></section>;
  if (authState === "guest") return <section className="home-panel friends-preview friends-preview-guest"><div className="home-panel-heading"><p className="eyebrow">FRIENDS PREVIEW</p></div><strong>Kết nối với đội hình của bạn</strong><p>Đăng nhập để xem bạn bè, presence và lời mời chơi.</p><Link className="button secondary" to={routes.login}>Đăng nhập</Link></section>;

  return <section className="home-panel friends-preview" aria-labelledby="friends-preview-title"><div className="home-panel-heading"><div><p className="eyebrow">FRIENDS PREVIEW</p><h2 id="friends-preview-title">Bạn bè</h2></div><Link className="home-panel-link" to={routes.friends}>Tất cả</Link></div>{state.kind === "loading" && <LoadingState label="Đang tải bạn bè…" />}{state.kind === "error" && <div className="home-inline-state"><strong>Không thể tải danh sách</strong><span>{state.message}</span><Button variant="secondary" onClick={load}>Thử lại</Button></div>}{state.kind === "ready" && state.friends.length === 0 && <div className="home-inline-state"><strong>Chưa có bạn bè</strong><span>Thêm người chơi để gửi lời mời vào phòng.</span><Link className="button ghost" to={routes.friends}>Tìm người chơi</Link></div>}{state.kind === "ready" && state.friends.length > 0 && <div className="friends-preview-list">{state.friends.slice(0, 4).map((friend) => <Link className="friends-preview-row" to={`/profile/${encodeURIComponent(friend.username)}`} key={friend.userId}><span className="home-avatar home-avatar-small" aria-hidden="true">{friend.displayName.slice(0, 1).toUpperCase()}</span><span className="friends-preview-copy"><strong>{friend.displayName}</strong><small>@{friend.username} · {friend.elo} Elo</small><span className={`presence ${friend.presence.toLowerCase()}`}><i />{presenceLabel(friend.presence)}</span></span><span className="friends-preview-record" aria-label={`${friend.rankedWins} thắng, ${friend.rankedLosses} thua`}>{friend.rankedWins}–{friend.rankedLosses}</span></Link>)}</div>}</section>;
}
