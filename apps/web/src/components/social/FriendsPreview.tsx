import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PresenceEvent, SocialUser } from "@ottv2/contracts";

import { routes } from "../../app/routes";
import { createInvite, getFriends, subscribeToPresence } from "../../services/social/socialApi";
import { ApiError } from "../../services/http/apiError";
import { Button, LoadingState, Modal, useToast } from "../ui";

const PREVIEW_LIMIT = 4;

export function FriendsPreview() {
  const { notify } = useToast();
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [inviteTarget, setInviteTarget] = useState<SocialUser | null>(null);
  const [roomId, setRoomId] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    getFriends().then((result) => { if (!mounted) return; setFriends(result.friends); setState(result.friends.length ? "ready" : "empty"); }).catch(() => { if (mounted) setState("error"); });
    const unsubscribe = subscribeToPresence((event: PresenceEvent) => setFriends((current) => current.map((friend) => friend.userId === event.user.userId ? { ...friend, presence: event.user.presence } : friend)), () => undefined);
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const invite = async () => {
    if (!inviteTarget) return;
    const normalized = roomId.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(normalized)) { notify("Room ID phải gồm 6 ký tự hợp lệ.", "warning"); return; }
    setPending(true);
    try { await createInvite(normalized, inviteTarget.userId); notify("Đã gửi lời mời vào phòng.", "success"); setInviteTarget(null); setRoomId(""); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : "Không thể gửi lời mời.", "error"); }
    finally { setPending(false); }
  };

  return <section className="friends-preview" aria-labelledby="friends-preview-heading">
    <div className="friends-preview-header"><div><p className="eyebrow">BẠN BÈ ONLINE</p><h2 id="friends-preview-heading">Bạn bè</h2><p className="rooms-subtitle">Trạng thái hiện diện chỉ hiển thị giữa những người đã kết bạn.</p></div><Link className="button secondary" to={routes.friends}>Xem tất cả bạn bè</Link></div>
    {state === "loading" && <div className="friends-preview-state"><LoadingState label="Đang tải bạn bè…" /></div>}
    {state === "error" && <div className="friends-preview-state"><strong>Không thể tải danh sách bạn bè</strong><p>Hãy thử lại ở trang Bạn bè.</p><Link className="button secondary" to={routes.friends}>Mở Bạn bè</Link></div>}
    {state === "empty" && <div className="friends-preview-state"><strong>Chưa có bạn bè</strong><p>Kết nối với người chơi khác để mời họ vào phòng.</p><Link className="button" to={routes.friends}>Tìm người chơi</Link></div>}
    {state === "ready" && <div className="friends-preview-grid">{friends.slice(0, PREVIEW_LIMIT).map((friend) => { const presence = friend.presence ?? "OFFLINE"; return <article className="friend-preview-card" key={friend.userId}><div className="avatar-mark small" aria-hidden="true">{friend.displayName.slice(0, 1).toUpperCase()}</div><div className="friend-preview-copy"><Link to={`/profile/${encodeURIComponent(friend.username)}`}><strong>{friend.displayName}</strong></Link><span>@{friend.username} · ★ {friend.elo}</span><small className={`presence ${presence.toLowerCase()}`}><i />{presenceLabel(presence)}</small></div><Button variant="secondary" disabled={presence === "IN_GAME"} onClick={() => setInviteTarget(friend)}>Mời chơi</Button></article>; })}</div>}
    <Modal open={Boolean(inviteTarget)} title="Mời bạn vào phòng" description={inviteTarget ? `Mời @${inviteTarget.username} vào phòng đang chờ.` : undefined} onClose={() => { setInviteTarget(null); setRoomId(""); }}><div className="form-stack"><label>Room ID<input value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase())} maxLength={6} placeholder="ABC234" /></label><div className="modal-actions"><Button variant="secondary" onClick={() => setInviteTarget(null)}>Hủy</Button><Button pending={pending} onClick={() => void invite()}>Gửi lời mời</Button></div></div></Modal>
  </section>;
}

function presenceLabel(status: SocialUser["presence"]): string { return status === "ONLINE" ? "Đang online" : status === "IN_GAME" ? "Đang chơi" : "Ngoại tuyến"; }
