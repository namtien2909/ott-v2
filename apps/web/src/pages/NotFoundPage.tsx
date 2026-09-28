import { Link } from "react-router-dom";
import { UiGlyph } from "../components/ui";
import { routes } from "../app/routes";

export default function NotFoundPage() {
  return <section className="placeholder not-found-page"><Link className="not-found-logo" to={routes.home} aria-label="Oẳn Tù Tì v2 — Về sảnh"><UiGlyph name="brand" size={24} /><span>OTT</span><strong>v2</strong></Link><p className="eyebrow">404 · KHÔNG TÌM THẤY</p><h1>Trang này không tồn tại</h1><p className="form-intro">Đường dẫn có thể đã đổi hoặc trận đấu đã được đóng. Bạn vẫn có thể quay lại sảnh để tiếp tục.</p><Link className="button primary" to={routes.home}>Về sảnh</Link></section>;
}
