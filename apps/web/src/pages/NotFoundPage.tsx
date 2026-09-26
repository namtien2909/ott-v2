import { Link } from "react-router-dom";
import { routes } from "../app/routes";
import { PagePlaceholder } from "./PagePlaceholder";
export default function NotFoundPage() { return <PagePlaceholder eyebrow="404" title="Không tìm thấy trang"><Link className="button primary" to={routes.home}>Về trang chủ</Link></PagePlaceholder>; }
