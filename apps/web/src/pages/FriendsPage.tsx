import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { FriendRequest, PresenceEvent, RoomInvite, SocialUser } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { ApiError } from "../services/http/apiError";
import { Button, LoadingState, Modal, useToast } from "../components/ui";
import { acceptInvite as acceptRoomInviteApi, blockUser, createInvite, getFriends, getInvites, getRequests, rejectInvite, removeFriend, searchUsers, sendFriendRequest, subscribeToPresence, updateFriendRequest } from "../services/social/socialApi";

type Tab = "friends" | "incoming" | "sent" | "search";
type PageState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };
type InviteComposerState = { kind: "idle" } | { kind: "pending" } | { kind: "success"; token: string } | { kind: "error" | "expired"; message: string };

function isExpiredInviteError(reason: unknown): boolean {
  return reason instanceof ApiError && (reason.code === "INVITE_INVALID" || reason.status === 410);
}

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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [inviteComposer, setInviteComposer] = useState<InviteComposerState>({ kind: "idle" });
  const searchRequest = useRef(0);

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
  useEffect(() => {
    const requestId = ++searchRequest.current;
    if (tab !== "search" || query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      searchUsers(query).then((response) => {
        if (requestId === searchRequest.current) setResults(response.results);
      }).catch((reason) => {
        if (requestId === searchRequest.current) notify(reason instanceof ApiError ? reason.message : "Không thể tìm người chơi.", "error");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, tab, notify]);

  const run = async (action: () => Promise<unknown>, success: string, actionKey: string) => {
    if (pendingAction) return;
    setPendingAction(actionKey);
    try { await action(); notify(success, "success"); await reload(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : "Thao tác không thành công.", "error"); }
    finally { setPendingAction(null); }
  };
  const block = async () => { if (!confirmBlock) return; const target = confirmBlock; setConfirmBlock(null); await run(() => blockUser(target.userId), `Đã chặn @${target.username}.`, `block:${target.userId}`); };
  const openInvite = (target: SocialUser) => { setInviteTarget(target); setRoomId(""); setInviteComposer({ kind: "idle" }); };
  const closeInvite = () => { if (inviteComposer.kind === "pending") return; setInviteTarget(null); setRoomId(""); setInviteComposer({ kind: "idle" }); };
  const invite = async () => {
    if (!inviteTarget || inviteComposer.kind === "pending") return;
    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!/^[A-Za-z0-9]{6}$/.test(normalizedRoomId)) { notify("Room ID phải gồm 6 ký tự.", "warning"); return; }
    setInviteComposer({ kind: "pending" });
    try {
      const response = await createInvite(normalizedRoomId, inviteTarget.userId);
      setInviteComposer({ kind: "success", token: response.invite.token });
      notify("Đã gửi lời mời vào phòng.", "success");
    } catch (reason) {
      const message = isExpiredInviteError(reason) ? "Phòng không còn nhận lời mời hoặc lời mời đã hết hạn." : reason instanceof ApiError ? reason.message : "Không thể gửi lời mời vào phòng.";
      setInviteComposer({ kind: isExpiredInviteError(reason) ? "expired" : "error", message });
      notify(message, isExpiredInviteError(reason) ? "warning" : "error");
    }
  };
  const handleAcceptRoomInvite = async (inviteToAccept: RoomInvite) => {
    if (pendingInviteToken) return;
    setPendingInviteToken(inviteToAccept.token);
    try {
      const response = await acceptRoomInviteApi(inviteToAccept.token);
      setInvites((current) => current.filter((invite) => invite.token !== inviteToAccept.token));
      notify("Đã vào phòng được mời.", "success");
      const room = response.room as { roomId?: string };
      if (room.roomId) navigate(`/room/${room.roomId}`);
    } catch (reason) {
      if (isExpiredInviteError(reason)) setInvites((current) => current.filter((invite) => invite.token !== inviteToAccept.token));
      notify(isExpiredInviteError(reason) ? "Lời mời đã hết hạn hoặc không còn hiệu lực." : reason instanceof ApiError ? reason.message : "Không thể nhận lời mời vào phòng.", isExpiredInviteError(reason) ? "warning" : "error");
    } finally { setPendingInviteToken(null); }
  };
  const rejectRoomInvite = async (inviteToReject: RoomInvite) => {
    if (pendingInviteToken) return;
    setPendingInviteToken(inviteToReject.token);
    try { await rejectInvite(inviteToReject.token); setInvites((current) => current.filter((invite) => invite.token !== inviteToReject.token)); notify("Đã từ chối lời mời vào phòng.", "success"); }
    catch (reason) { if (isExpiredInviteError(reason)) setInvites((current) => current.filter((invite) => invite.token !== inviteToReject.token)); notify(isExpiredInviteError(reason) ? "Lời mời đã hết hạn hoặc không còn hiệu lực." : reason instanceof ApiError ? reason.message : "Không thể từ chối lời mời.", isExpiredInviteError(reason) ? "warning" : "error"); }
    finally { setPendingInviteToken(null); }
  };

  if (state.kind === "loading") return <LoadingState fullPage label="Đang tải bạn bè…" />;
  if (state.kind === "error") return <section className="placeholder"><p className="eyebrow">BẠN BÈ</p><h1>Không thể tải bạn bè</h1><p className="form-intro">{state.message}</p><Button onClick={() => void reload()}>Thử lại</Button></section>;
  return <><section className="friends-page"><header className="friends-header"><div><p className="eyebrow">KẾT NỐI NGƯỜI CHƠI</p><h1>Bạn bè</h1><p className="form-intro">Kết nối riêng tư; trạng thái online chỉ hiển thị cho bạn bè.</p></div><Link className="button secondary" to={routes.profile}>Hồ sơ của tôi</Link></header><div className="friends-tabs" role="tablist" aria-label="Khu vực bạn bè">{([ ["friends", "BẠN BÈ"], ["incoming", "LỜI MỜI"], ["sent", "ĐÃ GỬI"], ["search", "TÌM NGƯỜI CHƠI"] ] as const).map(([value, label]) => <button className={`friends-tab ${tab === value ? "active" : ""}`} role="tab" aria-selected={tab === value} type="button" key={value} onClick={() => setTab(value)}>{label}{value === "incoming" && incoming.length > 0 ? ` · ${incoming.length}` : ""}</button>)}</div>{tab === "friends" && <FriendList friends={friends} pendingAction={pendingAction} onInvite={openInvite} onRemove={(friend) => void run(() => removeFriend(friend.userId), `Đã xoá @${friend.username} khỏi danh sách bạn bè.`, `remove:${friend.userId}`)} onBlock={setConfirmBlock} />}{tab === "incoming" && <Incoming requests={incoming} invites={invites} pendingAction={pendingAction} pendingRequestId={pendingAction?.startsWith("request:") ? pendingAction.slice("request:".length) : null} pendingInviteToken={pendingInviteToken} onAccept={(request) => void run(() => updateFriendRequest(request.requestId, "accept"), "Đã chấp nhận lời mời kết bạn.", `request:${request.requestId}`)} onReject={(request) => void run(() => updateFriendRequest(request.requestId, "reject"), "Đã từ chối lời mời.", `request:${request.requestId}`)} onAcceptInvite={handleAcceptRoomInvite} onRejectInvite={rejectRoomInvite} />}{tab === "sent" && <RequestList requests={sent} actionLabel="Hủy yêu cầu" pendingRequestId={pendingAction?.startsWith("request:") ? pendingAction.slice("request:".length) : null} onAction={(request) => void run(() => updateFriendRequest(request.requestId, "cancel"), "Đã hủy yêu cầu kết bạn.", `request:${request.requestId}`)} />}{tab === "search" && <SearchPanel query={query} onQuery={setQuery} results={results} pendingAction={pendingAction} onAdd={(user) => void run(() => sendFriendRequest(user.userId), `Đã gửi lời mời tới @${user.username}.`, `request:${user.userId}`)} onBlock={setConfirmBlock} />}</section><Modal open={Boolean(inviteTarget)} title="Mời bạn vào phòng" description={inviteTarget ? `Mời @${inviteTarget.username} · token chỉ dùng một lần` : undefined} onClose={closeInvite}><div className="form-stack"><label>Room ID<input value={roomId} onChange={(event) => { setRoomId(event.target.value.toUpperCase()); if (inviteComposer.kind !== "idle") setInviteComposer({ kind: "idle" }); }} maxLength={6} placeholder="ABC234" disabled={inviteComposer.kind === "pending" || inviteComposer.kind === "success"} /></label>{inviteComposer.kind === "pending" && <p className="form-hint" role="status">Đang gửi lời mời…</p>}{(inviteComposer.kind === "error" || inviteComposer.kind === "expired") && <p className="form-error" role="alert">{inviteComposer.message}</p>}{inviteComposer.kind === "success" && <div className="invite-token" role="status"><strong>Token một lần</strong><code aria-label="Token lời mời một lần">{inviteComposer.token}</code><span>Token này chỉ dùng một lần và được máy chủ kiểm tra khi bạn bè vào phòng.</span></div>}<div className="modal-actions"><Button variant="secondary" onClick={closeInvite}>{inviteComposer.kind === "success" ? "Đóng" : "Hủy"}</Button>{inviteComposer.kind !== "success" && <Button pending={inviteComposer.kind === "pending"} onClick={() => void invite()}>{inviteComposer.kind === "expired" ? "Thử lại" : "Gửi lời mời"}</Button>}</div></div></Modal><Modal open={Boolean(confirmBlock)} title={confirmBlock ? `Chặn ${confirmBlock.displayName}?` : "Chặn người chơi?"} description="Người này sẽ không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn." onClose={() => setConfirmBlock(null)}><div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmBlock(null)}>Hủy</Button><Button variant="danger" pending={pendingAction === `block:${confirmBlock?.userId}`} onClick={() => void block()}>Chặn</Button></div></Modal></>;
}

function FriendList({ friends, pendingAction, onInvite, onRemove, onBlock }: { friends: SocialUser[]; pendingAction: string | null; onInvite: (user: SocialUser) => void; onRemove: (user: SocialUser) => void; onBlock: (user: SocialUser) => void }) {
  if (friends.length === 0) return <EmptySocial title="Chưa có bạn bè" copy="Tìm một người chơi để bắt đầu kết nối." />;
  return <div className="friend-grid">{friends.map((friend) => <SocialCard key={friend.userId} user={friend} actions={<><Button variant="secondary" onClick={() => onInvite(friend)} disabled={friend.presence === "IN_GAME"}>Mời chơi</Button><FriendActionsMenu friend={friend} pendingAction={pendingAction} onRemove={onRemove} onBlock={onBlock} /></>} />)}</div>;
}

function FriendActionsMenu({ friend, pendingAction, onRemove, onBlock }: { friend: SocialUser; pendingAction: string | null; onRemove: (user: SocialUser) => void; onBlock: (user: SocialUser) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const focusFirstItem = () => root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); window.setTimeout(() => trigger.current?.focus(), 0); } };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", closeEscape);
    const frame = window.requestAnimationFrame(focusFirstItem);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  const moveMenuFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus();
    }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  };
  return <div className="friend-action-menu" ref={root}><button ref={trigger} id={`${menuId}-trigger`} className="icon-button friend-menu-trigger" type="button" aria-label={`Thao tác với ${friend.displayName}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={pendingAction === `remove:${friend.userId}` || pendingAction === `block:${friend.userId}`} onClick={() => setOpen((value) => !value)}>•••</button>{open && <div id={menuId} role="menu" aria-label={`Thao tác với ${friend.displayName}`} onKeyDown={moveMenuFocus}><Link role="menuitem" to={`/profile/${encodeURIComponent(friend.username)}`} onClick={() => setOpen(false)}>Xem hồ sơ</Link><button role="menuitem" type="button" disabled={Boolean(pendingAction)} onClick={() => { setOpen(false); onRemove(friend); }}>Xóa bạn</button><button role="menuitem" type="button" disabled={Boolean(pendingAction)} onClick={() => { setOpen(false); onBlock(friend); }}>Chặn</button></div>}</div>;
}

function SearchPanel({ query, onQuery, results, pendingAction, onAdd, onBlock }: { query: string; onQuery: (value: string) => void; results: SocialUser[]; pendingAction: string | null; onAdd: (user: SocialUser) => void; onBlock: (user: SocialUser) => void }) {
  return <div className="social-panel"><label className="social-search"><span>Tìm theo username hoặc tên hiển thị</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm theo username hoặc tên hiển thị" /></label>{query.trim().length >= 2 && results.length === 0 ? <EmptySocial title="Không có kết quả" copy="Thử một username hoặc tên hiển thị khác." /> : <div className="friend-grid">{results.map((user) => <SocialCard key={user.userId} user={user} showPresence={user.isFriend} actions={user.isFriend ? <span className="social-muted">Đã là bạn bè</span> : user.requestStatus ? <span className="social-muted">Đang chờ phản hồi</span> : <><Button pending={pendingAction === `request:${user.userId}`} onClick={() => onAdd(user)}>Kết bạn</Button><Button variant="ghost" disabled={Boolean(pendingAction)} onClick={() => onBlock(user)}>Chặn</Button></>} />)}</div>}</div>;
}

function Incoming({ requests, invites, pendingAction, pendingRequestId, pendingInviteToken, onAccept, onReject, onAcceptInvite, onRejectInvite }: { requests: FriendRequest[]; invites: RoomInvite[]; pendingAction: string | null; pendingRequestId: string | null; pendingInviteToken: string | null; onAccept: (request: FriendRequest) => void; onReject: (request: FriendRequest) => void; onAcceptInvite: (invite: RoomInvite) => void; onRejectInvite: (invite: RoomInvite) => void }) {
  return <div className="social-stack"><RequestList requests={requests} actionLabel="Chấp nhận" pendingRequestId={pendingRequestId} onAction={onAccept} secondaryAction={{ label: "Từ chối", onAction: onReject }} />{invites.length > 0 && <section className="invite-inbox" aria-labelledby="room-invites-heading"><p className="eyebrow" id="room-invites-heading">LỜI MỜI VÀO PHÒNG</p>{invites.map((invite) => <div className="invite-row" key={invite.token}><div><strong>@{invite.from.username}</strong><span>mời bạn vào phòng {invite.roomId}</span><small>Hết hạn {formatDate(invite.expiresAt)}</small></div><div><Button pending={pendingInviteToken === invite.token} onClick={() => onAcceptInvite(invite)}>Vào phòng</Button><Button variant="ghost" disabled={Boolean(pendingAction || pendingInviteToken)} onClick={() => onRejectInvite(invite)}>Từ chối</Button></div></div>)}</section>}</div>;
}

function RequestList({ requests, actionLabel, pendingRequestId, onAction, secondaryAction }: { requests: FriendRequest[]; actionLabel: string; pendingRequestId?: string | null; onAction: (request: FriendRequest) => void; secondaryAction?: { label: string; onAction: (request: FriendRequest) => void } }) {
  if (requests.length === 0) return <EmptySocial title="Không có yêu cầu" copy="Các lời mời đang chờ sẽ xuất hiện ở đây." />;
  return <div className="social-stack">{requests.map((request) => <div className="request-row" key={request.requestId}><div className="avatar-mark small" aria-hidden="true">{request.user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{request.user.displayName}</strong><span>@{request.user.username}</span><small>{secondaryAction ? "Muốn kết nối với bạn" : "Đang chờ phản hồi"}</small></div><div><Button pending={pendingRequestId === request.requestId} onClick={() => onAction(request)}>{actionLabel}</Button>{secondaryAction && <Button variant="ghost" disabled={Boolean(pendingRequestId)} onClick={() => secondaryAction.onAction(request)}>{secondaryAction.label}</Button>}</div></div>)}</div>;
}

function SocialCard({ user, actions, showPresence = true }: { user: SocialUser; actions: ReactNode; showPresence?: boolean }) {
  const presence = user.presence ?? "OFFLINE";
  return <article className="social-card"><div className="avatar-mark small" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</div><div className="social-card-copy"><Link to={`/profile/${encodeURIComponent(user.username)}`}><strong>{user.displayName}</strong></Link><span>@{user.username} · ★ {user.elo}</span>{showPresence && <small className={`presence ${presence.toLowerCase()}`}><i />{presence === "ONLINE" ? "Đang online" : presence === "IN_GAME" ? "Đang chơi" : "Ngoại tuyến"}</small>}<small>{user.rankedWins} thắng · {user.rankedLosses} thua</small></div><div className="social-card-actions">{actions}</div></article>;
}

function EmptySocial({ title, copy }: { title: string; copy: string }) { return <div className="social-empty"><p className="eyebrow">TRỐNG</p><h2>{title}</h2><p>{copy}</p></div>; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
