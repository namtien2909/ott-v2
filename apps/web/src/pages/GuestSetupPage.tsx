import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { routes } from "../app/routes";
import { getGuestProfile, setGuestProfile } from "../services/local/localGameStorage";

export default function GuestSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void getGuestProfile().then((profile) => { if (profile) setName(profile.displayName); }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName.length < 2 || displayName.length > 20) { setError("Tên khách phải dài 2–20 ký tự."); return; }
    await setGuestProfile({ displayName });
    navigate("/guest/play");
  }

  return <section className="local-page setup-page"><div className="local-setup-card"><p className="eyebrow">GUEST / LOCAL-FIRST</p><h1>Chơi nhanh với tư cách khách</h1><p className="form-intro">Tên và lịch sử Guest chỉ lưu trên thiết bị này. Bạn có thể đồng bộ lịch sử sau khi tạo tài khoản.</p><div className="guest-warning" role="status"><strong>Bạn đang chơi với tư cách khách</strong><span>Lịch sử trên thiết bị này có thể bị mất nếu xoá dữ liệu trình duyệt.</span></div><form className="form-stack" onSubmit={(event) => void submit(event)}><label>Tên hiển thị<input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} minLength={2} maxLength={20} placeholder="Ví dụ: Người chơi Xanh" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><Link className="button secondary" to={routes.home}>Quay lại</Link><Button type="submit">Tiếp tục</Button></div></form></div></section>;
}
