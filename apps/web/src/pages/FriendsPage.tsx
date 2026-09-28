import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { FriendRequest, PresenceEvent, RoomInvite, SocialUser } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { ApiError } from "../services/http/apiError";
import { Button, LoadingState, Modal, useToast } from "../components/ui";
import { acceptInvite as acceptRoomInvite, blockUser, createInvite, getFriends, getInvites, getRequests, rejectInvite, removeFriend, searchUsers, sendFriendRequest, subscribeToPresence, updateFriendRequest } from "../services/social/socialApi";

type Tab = "friends" | "incoming" | "sent" | "search";
type PageState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

export default function FriendsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("friends");
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SocialUser[]>([]);
  const [inviteTarget, setInviteTarget] = useState<SocialUser | null>(null);
  const [roomId, setRoomId] = useState("");
  const [confirmBlock, setConfirmBlock] = useState<SocialUser | null>(null);

  const reload = async () => {
    setState({ kind: "loading" });
    try {
      const [friendsResponse, incomingResponse, sentResponse, inviteResponse] = await Promise.all([getFriends(), getRequests("incoming"), getRequests("sent"), getInvites()]);
      setFriends(friendsResponse.friends); setIncoming(incomingResponse.requests); setSent(sentResponse.requests); setInvites(inviteResponse.invites); setState({ kind: "ready" });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) navigate(routes.login);
      else setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải dữ liệu bạn bè." });
    }
  };

  // reload is intentionally stable for this mount-only bootstrap; mutations call it explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); const unsubscribe = subscribeToPresence((event: PresenceEvent) => { setFriends((current) => current.map((friend) => friend.userId === event.user.userId ? { ...friend, presence: event.user.presence } : friend)); }, () => notify("Presence bị gián đoạn. Danh sách vẫn được giữ an toàn.", "warning")); return unsubscribe; }, [navigate, notify]);
  useEffect(() => { if (tab !== "search" || query.trim().length < 2) { setResults([]); return; } const timer = window.setTimeout(() => { searchUsers(query).then((response) => setResults(response.results)).catch((reason) => notify(reason instanceof ApiError ? reason.message : "Không thể tìm người chơi.", "error")); }, 300); return () => window.clearTimeout(timer); }, [query, tab, notify]);

  const run = async (action: () => Promise<unknown>, success: string) => { try { await action(); notify(success, "success"); await reload(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : "Thao tác không thành công.", "error"); } };
  const block = async () => { if (!confirmBlock) return; const target = confirmBlock; setConfirmBlock(null); await run(() => blockUser(target.userId), `Đã chặn @${target.username}.`); };
  const invite = async () => { if (!inviteTarget) return; if (!/^[A-Za-z0-9]{6}$/.test(roomId.trim())) { notify("Room ID phải gồm 6 ký tự.", "warning"); return; } await run(() => createInvite(roomId.trim().toUpperCase(), inviteTarget.userId), "Đã gửi lời mời vào phòng."); setInviteTarget(null); setRoomId(""); };

  if (state.kind === "loading") return <LoadingState fullPage label="Đang tải bạn bè…" />;
  if (state.kind === "error") return <section className="placeholder"><p className="eyebrow">BẠN BÈ</p><h1>Không thể tải bạn bè</h1><p className="form-intro">{state.message}</p><Button onClick={() => void reload()}>Thử lại</Button></section>;
  return <><section className="friends-page"><header className="friends-header"><div><p className="eyebrow">KẾT NỐI NGƯỜI CHƠI</p><h1>Bạn bè</h1><p className="form-intro">Kết nối riêng tư; trạng thái online chỉ hiển thị cho bạn bè.</p></div><Link className="button secondary" to={routes.profile}>Hồ sơ của tôi</Link></header><div className="friends-tabs" role="tablist" aria-label="Khu vực bạn bè">{([ ["friends", "BẠN BÈ"], ["incoming", "LỜI MỜI"], ["sent", "ĐÃ GỬI"], ["search", "TÌM NGƯỜI CHƠI"] ] as const).map(([value, label]) => <button className={`friends-tab ${tab === value ? "active" : ""}`} role="tab" aria-selected={tab === value} type="button" key={value} onClick={() => setTab(value)}>{label}{value === "incoming" && incoming.length > 0 ? ` · ${incoming.length}` : ""}</button>)}</div>{tab === "friends" && <FriendList friends={friends} onInvite={setInviteTarget} onRemove={(friend) => void run(() => removeFriend(friend.userId), `Đã xoá @${friend.username} khỏi danh sách bạn bè.`)} onBlock={setConfirmBlock} />}{tab === "incoming" && <Incoming requests={incoming} invites={invites} onAccept={(request) => void run(() => updateFriendRequest(request.requestId, "accept"), "Đã chấp nhận lời mời kết bạn.")} onReject={(request) => void run(() => updateFriendRequest(request.requestId, "reject"), "Đã từ chối lời mời.")} onAcceptInvite={(invite) => acceptRoomInvite(invite.token).then((response) => { notify("Đã vào phòng được mời.", "success"); const room = response.room as { roomId?: string }; if (room.roomId) navigate(`/room/${room.roomId}`); return reload(); }).catch((reason) => notify(reason instanceof ApiError ? reason.message : "Lời mời đã hết hạn.", "error"))} onRejectInvite={(invite) => void run(() => rejectInvite(invite.token), "Đã từ chối lời mời vào phòng.")} />}{tab === "sent" && <RequestList requests={sent} actionLabel="Hủy yêu cầu" onAction={(request) => void run(() => updateFriendRequest(request.requestId, "cancel"), "Đã hủy yêu cầu kết bạn.")} />}{tab === "search" && <SearchPanel query={query} onQuery={setQuery} results={results} onAdd={(user) => void run(() => sendFriendRequest(user.userId), `Đã gửi lời mời tới @${user.username}.`)} onBlock={setConfirmBlock} />}</section><Modal open={Boolean(inviteTarget)} title="Mời bạn vào phòng" description={inviteTarget ? `Mời @${inviteTarget.username} · token chỉ dùng một lần` : undefined} onClose={() => { setInviteTarget(null); setRoomId(""); }}><div className="form-stack"><label>Room ID<input value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase())} maxLength={6} placeholder="ABC234" /></label><div className="modal-actions"><Button variant="secondary" onClick={() => { setInviteTarget(null); setRoomId(""); }}>Hủy</Button><Button onClick={() => void invite()}>Gửi lời mời</Button></div></div></Modal><Modal open={Boolean(confirmBlock)} title={confirmBlock ? `Chặn ${confirmBlock.displayName}?` : "Chặn người chơi?"} description="Người này sẽ không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn." onClose={() => setConfirmBlock(null)}><div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmBlock(null)}>Hủy</Button><Button variant="danger" onClick={() => void block()}>Chặn</Button></div></Modal></>;
}

function FriendList({ friends, onInvite, onRemove, onBlock }: { friends: SocialUser[]; onInvite: (user: SocialUser) => void; onRemove: (user: SocialUser) => void; onBlock: (user: SocialUser) => void }) {
  if (friends.length === 0) return <EmptySocial title="Chưa có bạn bè" copy="Tìm một người chơi để bắt đầu kết nối." />;
  return <div className="friend-grid">{friends.map((friend) => <SocialCard key={friend.userId} user={friend} actions={<><Button variant="secondary" onClick={() => onInvite(friend)} disabled={friend.presence === "IN_GAME"}>Mời chơi</Button><Button variant="ghost" onClick={() => onRemove(friend)}>Xóa bạn</Button><Button variant="ghost" onClick={() => onBlock(friend)}>Chặn</Button></>} />)}</div>;
}

function SearchPanel({ query, onQuery, results, onAdd, onBlock }: { query: string; onQuery: (value: string) => void; results: SocialUser[]; onAdd: (user: SocialUser) => void; onBlock: (user: SocialUser) => void }) {
  return <div className="social-panel"><label className="social-search"><span>Tìm theo username hoặc tên hiển thị</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm theo username hoặc tên hiển thị" /></label>{query.trim().length >= 2 && results.length === 0 ? <EmptySocial title="Không có kết quả" copy="Thử một username hoặc tên hiển thị khác." /> : <div className="friend-grid">{results.map((user) => <SocialCard key={user.userId} user={user} showPresence={user.isFriend} actions={user.isFriend ? <span className="social-muted">Đã là bạn bè</span> : user.requestStatus ? <span className="social-muted">Đang chờ phản hồi</span> : <><Button onClick={() => onAdd(user)}>Kết bạn</Button><Button variant="ghost" onClick={() => onBlock(user)}>Chặn</Button></>} />)}</div>}</div>;
}

function Incoming({ requests, invites, onAccept, onReject, onAcceptInvite, onRejectInvite }: { requests: FriendRequest[]; invites: RoomInvite[]; onAccept: (request: FriendRequest) => void; onReject: (request: FriendRequest) => void; onAcceptInvite: (invite: RoomInvite) => void; onRejectInvite: (invite: RoomInvite) => void }) {
  return <div className="social-stack"><RequestList requests={requests} actionLabel="Chấp nhận" onAction={onAccept} secondaryAction={{ label: "Từ chối", onAction: onReject }} />{invites.length > 0 && <section className="invite-inbox"><p className="eyebrow">LỜI MỜI VÀO PHÒNG</p>{invites.map((invite) => <div className="invite-row" key={invite.token}><div><strong>@{invite.from.username}</strong><span>mời bạn vào phòng {invite.roomId}</span><small>Hết hạn {formatDate(invite.expiresAt)}</small></div><div><Button onClick={() => onAcceptInvite(invite)}>Vào phòng</Button><Button variant="ghost" onClick={() => onRejectInvite(invite)}>Từ chối</Button></div></div>)}</section>}</div>;
}

function RequestList({ requests, actionLabel, onAction, secondaryAction }: { requests: FriendRequest[]; actionLabel: string; onAction: (request: FriendRequest) => void; secondaryAction?: { label: string; onAction: (request: FriendRequest) => void } }) {
  if (requests.length === 0) return <EmptySocial title="Không có yêu cầu" copy="Các lời mời đang chờ sẽ xuất hiện ở đây." />;
  return <div className="social-stack">{requests.map((request) => <div className="request-row" key={request.requestId}><div className="avatar-mark small" aria-hidden="true">{request.user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{request.user.displayName}</strong><span>@{request.user.username}</span><small>{secondaryAction ? "Đang chờ phản hồi" : "Muốn kết nối với bạn"}</small></div><div><Button onClick={() => onAction(request)}>{actionLabel}</Button>{secondaryAction && <Button variant="ghost" onClick={() => secondaryAction.onAction(request)}>{secondaryAction.label}</Button>}</div></div>)}</div>;
}

function SocialCard({ user, actions, showPresence = true }: { user: SocialUser; actions: ReactNode; showPresence?: boolean }) {
  return <article className="social-card"><div className="avatar-mark small" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</div><div className="social-card-copy"><Link to={`/profile/${encodeURIComponent(user.username)}`}><strong>{user.displayName}</strong></Link><span>@{user.username} · ★ {user.elo}</span>{showPresence && <small className={`presence ${user.presence.toLowerCase()}`}><i />{user.presence === "ONLINE" ? "Online" : user.presence === "IN_GAME" ? "Đang chơi" : "Offline"}</small>}<small>{user.rankedWins} thắng · {user.rankedLosses} thua</small></div><div className="social-card-actions">{actions}</div></article>;
}

function EmptySocial({ title, copy }: { title: string; copy: string }) { return <div className="social-empty"><p className="eyebrow">TRỐNG</p><h2>{title}</h2><p>{copy}</p></div>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
