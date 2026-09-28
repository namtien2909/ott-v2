# Wave B10 — Settings evidence

## Scope

B10 chỉ thay đổi presentation settings: theme, quality tier, motion, audio, account/profile/password, presence visibility và blocked-user list. Không thêm game-rule hoặc mock production.

## Implementation

- `SettingsPage` có các tab Giao diện, Âm thanh, Tài khoản, Riêng tư và Đã chặn; deep-link `?tab=appearance|audio|account|privacy|blocked` mở đúng section.
- Giao diện áp dụng live theme, quality `Tự động/Cao/Vừa/Thấp`, reduced motion và ambient motion; tất cả preference presentation được lưu local.
- Guest/offline vẫn mở được phần local presentation settings; account-only actions hiển thị link đăng nhập.
- Audio tách Master/SFX/BGM/countdown và master/SFX/BGM volume; autoplay/BGM failure vẫn im lặng.
- Auto quality downgrade phát toast có action mở `/cai-dat?tab=appearance`.
- Quality detection nhận `QualityEnvironment` để test deterministic; legacy SFX volume key vẫn được đọc để tương thích.

## State/dependency coverage

- Local storage reload: theme, quality, motion, audio toggle/volume.
- Authenticated sync: theme và presence qua canonical profile API; server failure không xoá local value.
- Guest/offline: local presentation settings hoạt động không cần profile endpoint.
- Account/profile/password, privacy presence, blocked/unblock dùng API canonical hiện có.
- Mobile: settings tabs scroll ngang trong một hàng; cards chuyển một cột dưới 700px.
- Backend dependency: không mở rộng contract; `theme`, `presenceVisibility`, blocked list đã có sẵn.

## Verification evidence

- `corepack pnpm typecheck` — pass (`TYPECHECK:0`).
- `corepack pnpm lint` — pass (`LINT:0`).
- `corepack pnpm build` — pass (`BUILD:0`); Settings chunk emitted. Build có warning annotation từ dependency zod, không phải lỗi.
- `corepack pnpm test` — pass, 12 files / 50 tests.
- B10-focused frontend tests — pass, 4 files / 9 tests:
  `corepack pnpm --filter @ottv2/web exec vitest run src/foundation/foundation.test.ts src/services/presentation/preferences.test.ts src/theme/ThemeProvider.test.tsx src/components/ui/ToastProvider.test.tsx --maxWorkers=1 --minWorkers=1`
- Full web Vitest suite was attempted with one worker; it reported an unrelated B9 failure currently present in `src/pages/FriendsPage.test.tsx` (focus-trap pending invite modal). No B9 code was changed as part of B10.

## Fallback/rollback

Unknown or unavailable local storage falls back to safe defaults. Audio and autoplay exceptions are swallowed. Removing the B10 files restores the prior Settings/presentation behavior without schema migration.

## Known deferred item

No visual browser snapshot or axe report was added in this wave; those belong to the cross-cutting B13 QA gate.
