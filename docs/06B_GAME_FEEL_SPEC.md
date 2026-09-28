# 06B_GAME_FEEL_SPEC.md

# Game Feel / Art Direction / VFX / Audio — OTTv2 v0.2

**Document Status:** FRONTEND SPECIFICATION ADDENDUM — READY FOR IMPLEMENTATION
**Version:** 0.2
**Authority:** Overrides `06_FRONTEND_UI_SPEC.md` on visual, motion, effects and audio topics only
**Placement:** Same folder as `06_FRONTEND_UI_SPEC.md`
**Language rule:** Vietnamese for UI text, data labels and domain names; English for identifiers, tokens, states and implementation terms
**Target agent:** Codex (agent-neutral wording; every MUST is testable)

---

# 0. PRECEDENCE AND OVERRIDES

06B does NOT redefine game rules, network protocol, routes, screen states, data contracts or backend behavior. Those remain owned by `SRS.md`, `03_NETWORK_SPEC.md`, `@ottv2/contracts`, `@ottv2/game-rules` and `06_FRONTEND_UI_SPEC.md`.

| 06 section | Action | Note |
| :--- | :--- | :--- |
| §1 North Star "Futuristic Competitive Command Arena" | REPLACED | See 06B §1 |
| §1 "AAA-like does not mean maximum effects" | REPLACED | AAA here means dense, layered, tactile effects inside a performance budget (06B §9) |
| §3.1 Color roles | EXTENDED | Blue, Red, System Cyan unchanged. Accent palette added (06B §2) |
| §3.3 "Avoid overly rounded consumer-app styling" | KEPT | |
| §3.4 "Avoid heavy glassmorphism" | PARTIALLY OVERRIDDEN | Frosted glass allowed on Auth cards and overlays. Never on the board |
| §4 Background language | REPLACED | See 06B §5 |
| §5 Motion system | REPLACED | See 06B §6 |
| §6 Sound system | EXTENDED | Background music now in scope, default OFF (06B §10) |
| §28 Board visual | EXTENDED | Glass grid board (06B §4). "No heavy 3D perspective" KEPT |
| §30 Piece contract | PARTIALLY REPLACED | Emoji replaced by vector neon glyph. Occupancy 82-88%, side-first hierarchy and color-blind motif KEPT |
| §33 Turn indicator | KEPT | No cinematic per turn |
| §34 "Never flash entire board red" | KEPT | Tension uses slow border pulse only (06B §8, VFX-04) |
| §35 Capture animation 250-400ms | REPLACED | See VFX-03 |
| §79 Out of scope | AMENDED | Full 3D board, video backgrounds, cosmetics shop, battle pass stay out. BGM and Elo rank badges are now in scope |

Everything not listed above stays authoritative in `06_FRONTEND_UI_SPEC.md`.

---

# 1. NORTH STAR

> **Neon Esports Arena**

```text
Deep Graphite-Navy Arena
+ Neon Grid / Hologram Language
+ Side Identity: Electric Blue vs Hot Red
+ System Actions: Electric Cyan
+ Reward / Hype Accents: Violet, Magenta, Amber
+ Sharp, Fast, Decisive Motion
+ Dense Effects in Overlay Layers
+ Synthwave Audio Identity
```

Principles:

| # | Principle | Testable meaning |
| :--- | :--- | :--- |
| 1 | Side First | Blue vs Red is readable before piece type at any size and theme |
| 2 | Density Around, Clarity Inside | Heavy effects live in overlay layers around and above the board. Board tiles stay minimal |
| 3 | Sharp, Not Bouncy | No overshoot, no bounce, no elastic easing anywhere |
| 4 | Budgeted Spectacle | Every effect has a tiered particle and layer budget (06B §9) |
| 5 | Server Authority | Effects never delay, block or invent game state |

---

# 2. COLOR SYSTEM

## 2.1 Dark Theme (full effects)

| Token | Value | Use |
| :--- | :--- | :--- |
| BG-ROOT | #05070D | App base |
| BG-SECONDARY | #0A0F1A | Section base |
| SURFACE-1 | #0F1626 | Panels |
| SURFACE-2 | #151E33 | Raised cards |
| SURFACE-3 | #1C2842 | Hovered or active surfaces |
| GLASS | #0F1626 at 60% alpha + 1px border white 8% | Auth card, overlays |
| TEXT-PRIMARY | #F5F8FC | |
| TEXT-SECONDARY | #A9B5C6 | |
| TEXT-MUTED | #6F7D90 | |

## 2.2 Identity and Accent Colors

| Role | Token | Value | Rule |
| :--- | :--- | :--- | :--- |
| System | SYSTEM-CYAN | #44E7FF | CTA, focus, legal-move markers |
| Blue side | BLUE-PLAYER / HIGH | #267BFF / #55A1FF | Exclusive to Blue side |
| Red side | RED-PLAYER / HIGH | #FF3F5E / #FF7188 | Exclusive to Red side |
| Accent | VIOLET | #8B5CFF | Gradients, ambient, rank |
| Accent | MAGENTA | #FF3FD2 | Victory, hype moments |
| Accent | AMBER | #FFC94A | Rewards, Elo gain, capture target ring |
| Status | SUCCESS / WARNING / ERROR | #41D98A / #F3B84B / #FF684B | Unchanged |

Blue and Red MUST NOT be used for decoration unrelated to a side.

## 2.3 Named Gradients

| Name | Stops | Use |
| :--- | :--- | :--- |
| ARENA-AURORA | Violet to Cyan | Ambient, hero title |
| SYSTEM-PULSE | Cyan to Blue-High | Primary CTA |
| VICTORY | Amber to Magenta | Win banner |
| DEFEAT | Red to deep Violet | Loss banner |
| LEGEND | Magenta to Violet to Cyan (animated hue drift) | Top rank badge |

## 2.4 Glow Rules

- Max 2 glow layers per element.
- Glow color derives from the element's role color at 40-60% alpha.
- Glow blur radius: card up to 24px, token up to 14px, text up to 12px.
- Do not animate blur radius. Animate opacity or transform of a pre-rendered glow.

## 2.5 Light Theme "Neon Sáng"

| Item | Rule |
| :--- | :--- |
| Base | BG #EEF3FB, surfaces #FFFFFF, text #0B1220 |
| Side identity | Blue and Red hex values identical to Dark |
| Borders | Neon borders remain at full saturation |
| Glow | 50% of Dark intensity |
| Ambient | Static gradients and sparse small particles. No scanline overlay |
| Effects | Capture, VS and Result effects remain but at Medium-tier budget |
| Board | Light glass tiles with cyan grid lines at 35% alpha |

---

# 3. TYPOGRAPHY

| Role | Font | Rule |
| :--- | :--- | :--- |
| Display | Space Grotesk (Vietnamese subset verified) | Hero and banners. Gradient fill allowed, glow max 1 layer |
| Body | Be Vietnam Pro | UI text |
| Data | Monospace with tabular numerals | Clocks, Elo, ping, coordinates, counters |
| Micro-label | Uppercase, letter-spacing 0.12-0.2em, size 11-12px | Section eyebrows such as "ĐẤU TRÍ · ĐỌC VỊ · CHIẾM BÀN" |

Vietnamese diacritics MUST render without clipping at all display sizes (line-height check on "Oẳn Tù Tì").

---

# 4. BOARD AND PIECE VISUAL CONTRACT

## 4.1 Piece Layers (bottom to top)

| Layer | Spec |
| :--- | :--- |
| Contact shadow | Soft, low opacity |
| Body | Solid side color with inner gradient. Chamfered squircle. Footprint 82-88% of cell |
| Rim light | Side high color, 1-2px |
| Side motif | Kept from 06 §30 (Blue upper-edge, Red lower-diagonal) for color-blind redundancy |
| Glyph | Thin neon line-art, near-white with side tint, stroke about 6% of token width, 1 glow layer |

Glyphs (custom vector SVG, no emoji, no icon-font):

| Type (VN) | Type (code) | Glyph |
| :--- | :--- | :--- |
| Đấm | ROCK | Closed fist |
| Bao | PAPER | Open palm |
| Kéo | SCISSORS | Two-finger scissors |

Acceptance: the three glyphs are distinguishable at 28px token size in both themes. Glyph-to-body contrast ratio at least 3:1.

## 4.2 Piece States

| State | Visual |
| :--- | :--- |
| IDLE | Static, faint glyph breathing (opacity 90-100%, 3s) High tier only |
| HOVER | Glyph brightness up, tile lights up cyan 12% |
| SELECTED | Lift 2px, scale 1.06, cyan ring pulse 1.2s loop. Body color never changes |
| LEGAL (empty) | Cyan dot at least 14px plus tile edge glow |
| CAPTURE_TARGET | Amber crosshair ring around target token |
| BLOCKED | 2px shake 120ms on the piece plus single warm tile-edge flash. Optional short toast |
| MOVING | Slide 160-220ms with short fading trail |
| CAPTURED | See VFX-03 |
| DISABLED | 45% opacity, no glow |

## 4.3 Board

| Item | Spec |
| :--- | :--- |
| Surface | Dark glass slab, thin neon grid lines (1px, cyan 18% alpha), alternating tile tint very subtle |
| Hover tile | Cyan 12% fill plus edge highlight |
| Last move | From and to tiles get subtle side-colored edge |
| Coordinates | a-i and 1-9, monospace, muted. Always canonical labels (06 §29) |
| Frame | Thin neon outer border with four corner brackets. Active-turn side color tints one frame edge |
| Goal tiles | a1 (RED target) and i9 (BLUE target): "energy core" with corner brackets and 4s breathing glow in the owning side color |
| Dominance | Board occupies about 55-65% of visual attention (06 §26) |

---

# 5. ARENA BACKGROUND (AMBIENT)

| Layer | Content | High | Medium | Low |
| :--- | :--- | :--- | :--- | :--- |
| L0 | Base gradient | On | On | On |
| L1 | Low-opacity flat grid | On | On | On |
| L2 | Drifting data dots | On | On | Static |
| L3 | Aurora blobs (blurred radial gradients, slow drift, max 2) | On | 1 blob | Off |
| L4 | Scanline overlay (very low alpha) | On | On | Off |
| L5 | Ambient particles (canvas) | On | 40% count | Off |

Context tinting:

| Context | Tint |
| :--- | :--- |
| Home, Queue | Cyan and Violet |
| Game | Neutral and dimmed to about 60% so the board pops |
| Victory | Warm Amber and Magenta |
| Defeat | Cold Red and Violet, desaturated |

No video backgrounds. Reduced Motion turns all ambient movement off.

---

# 6. MOTION SYSTEM: SHARP ESPORTS

Personality: fast, decisive, zero overshoot.

| Class | Duration |
| :--- | :--- |
| MICRO | 90-140ms |
| UI TRANSITION | 140-220ms |
| GAMEPLAY MOVE | 160-220ms |
| CAPTURE SEQUENCE | 600-900ms |
| CINEMATIC ENTRANCE (VS, Result) | 900-1600ms |
| PAGE GLITCH | about 250ms |

Easing tokens: EASE-OUT-SHARP (enter, emphasis), EASE-IN-SHARP (exit), LINEAR (scanline sweeps and loops). No bounce or elastic curve exists in the system.

## 6.1 Route Transition (glitch)

- Scanline sweeps top to bottom while an RGB channel split of about 3px peaks near 120ms. Total about 250ms.
- Runs on every route change.
- Reduced Motion: 150ms fade. Low tier: scanline only.
- Must never delay data loading. Content mounts underneath.

## 6.2 Hover and Press (desktop)

| Target | Behavior |
| :--- | :--- |
| Large cards (Home mode cards, TÌM TRẬN) | 3D tilt max 6 degrees, cursor spotlight, magnetic pull max 8px on buttons, running border light 3s loop, ripple 400ms on press |
| Small cards | Lift 2px plus border brighten |
| Buttons | Press scale 0.97 in 80ms, ripple on primary |
| Touch devices | No hover effects. Press feedback: scale 0.97 plus ripple |

## 6.3 Photosensitivity Safety

- No element flashes more than 3 times per second. Pulses loop at 2Hz or slower.
- Full-screen brightness flash: at most one frame burst up to 80ms and at most 12% luminance change.
- Screen shake max 3px, 150ms, never repeated within 400ms.

---

# 7. SCREEN COMPOSITION CONTRACTS (ALL 12 ROUTES)

Priority column: P0 must ship, P1 should ship, P2 nice to have.

| Screen | Composition | Signature effect | Pri |
| :--- | :--- | :--- | :--- |
| Login, Register, Forgot Password, Recovery Code | Full-screen animated arena background, huge logo "OẲN TÙ TÌ v2" with ARENA-AURORA gradient, frosted glass form card centered. Recovery Code as a hologram card with copy action, shown once | Input neon focus ring, primary button running light | P0 |
| Home (Lobby) | Three columns. Left: profile card (avatar frame, name, rank badge, Elo, thắng/thua). Center: giant TÌM TRẬN button (SYSTEM-PULSE, pulse plus running border) with three small cards below (Chơi với máy, Chơi Offline, Chơi Guest). Right: room list (4x2 visible, internal scroll), "Tạo phòng", online friends preview. Slim server-status strip retained | Tilt, spotlight, magnetic on TÌM TRẬN and mode cards | P0 |
| Home (Guest variant) | Profile card becomes registration invite. TÌM TRẬN becomes "ĐĂNG NHẬP ĐỂ XẾP HẠNG". Local-history warning per 06 §17 | | P0 |
| Queue (Matchmaking) | Centered radar: concentric cyan rings sweeping, fist glyph token at center. Three stat cards (Rating, Khoảng tìm kiếm, Thời gian) with tabular numerals. Cancel is a danger button | Rings expand when the search range widens | P1 |
| Match Found / VS | Diagonal split: Blue left, Red right, VS at center. Avatar, name, rank badge and Elo slide in from each side (about 300ms). Countdown 3-2-1 follows server clock. Total at most about 3s | VS impact: scale-in 200ms, shock ring, micro shake 80ms | P0 |
| Waiting Room | Two large hologram slots (Blue, Red), ready state glowing, room code chip with copy, host crown, Space fast-ready hint | Ready toggle glow | P1 |
| Game | Esports layout: opponent HUD above board, own HUD below, board center, right column move log plus combat feed, minimal header (06 §27) | Turn accent, clock warnings, VFX-02 to VFX-04 | P0 |
| Result | Huge banner CHIẾN THẮNG (VICTORY gradient, fireworks) or THUA CUỘC (DEFEAT gradient, falling embers, board desaturated 40%). Below: Elo count-up card (Ranked only), stats row (Số nước đi, Quân ăn được, Quân bị mất, Thời gian ván), buttons "ĐẤU LẠI" and "Về sảnh". Board dimmed behind | VFX-06 to VFX-08 | P0 |
| History and Match Detail | Match cards with result accent strip, filter chips, detail shows final-position thumbnail | Card lift, glitch route transition | P1 |
| Profile | "Hồ sơ chiến binh" dossier: large avatar frame, rank badge with tier glow, stats grid | Rank badge glow | P1 |
| Friends | Cards with presence dot, incoming and sent request tabs | Card lift | P2 |
| Settings | Groups: Giao diện (Sáng, Tối, Hệ thống; Chất lượng hiệu ứng Tự động, Cao, Vừa, Thấp), Âm thanh (SFX, Nhạc nền, âm lượng), Chuyển động (Giảm chuyển động), Tài khoản | Live preview of quality tier | P1 |

Result screen for non-Ranked modes (Unranked, AI, Offline, Guest): no Elo card. Stats row only.

---

# 8. VFX CATALOG

Particle caps are per effect instance, listed High / Medium / Low.

| ID | Trigger | Visual | Duration | Particles H/M/L | Pri |
| :--- | :--- | :--- | :--- | :--- | :--- |
| VFX-01 Move | Accepted move | Token slide plus short fading trail | 160-220ms | 6 / 3 / 0 | P0 |
| VFX-02 Select | Piece selected | Lift plus cyan ring pulse, legal markers pop in with 20ms stagger | 140ms | 0 | P0 |
| VFX-03 Capture | Capture accepted | Tile impact flash (60ms), defender glyph glitch-split (120ms), defender shatters into shards, shockwave ring from tile (300ms), attacker glow pulse (200ms), shake 3px 150ms, combat feed line | 600-900ms | 60 / 30 / 12 | P0 |
| VFX-04 Goal Tension | Canonical board where a piece can reach the enemy goal tile in 1 move (level 2) or 2 moves (level 1) | Level 1: goal tile glow intensifies. Level 2: goal tile pulses plus board border pulse at 1.5Hz. Attacker sees amber "opportunity", defender sees red "danger". Heartbeat SFX loop and BGM duck 3dB. Ends immediately when the threat is gone | Loop | 0 | P0 |
| VFX-05 Match Found | Server match confirmed | See §7 VS | 2.5-3s | 30 / 15 / 0 | P0 |
| VFX-06 Victory | Player wins | Banner reveal 700ms, firework bursts | 3-4s | 5x40 / 3x20 / static glow | P0 |
| VFX-07 Defeat | Player loses | Banner reveal 600ms, slow embers, board desaturation | 3s | 40 / 20 / 0 | P0 |
| VFX-08 Elo and Rank | Result of Ranked match | Elo count-up 1200ms with tick per 10 points. Rank up: badge flip plus ring burst. Rank down: badge dims | 1.2-2s | 20 / 10 / 0 | P1 |
| VFX-09 Route Glitch | Route change | See §6.1 | 250ms | 0 | P0 |
| VFX-10 Clock Warning | Under 30s: amber. Under 10s: red pulse at most 2Hz plus tick | Loop | 0 | P0 |
| VFX-11 Toast | Any toast | Slide-in 160ms, edge glow by type | 160ms | 0 | P1 |
| VFX-12 Combat Feed | On capture | Line such as "Đấm đã ăn Kéo", lasts 1.5s in the right column | 1.5s | 0 | P1 |

Rules:

- Game state renders immediately. VFX are cosmetic and MUST NOT delay state, input or clocks.
- If several events arrive together (for example STATE_RESYNC), coalesce and suppress duplicate animations (06 §70).
- Pause all effects when the tab is hidden. Clean up on unmount.
- Goal-tension level is derived from canonical state using `@ottv2/game-rules` helpers. The UI MUST NOT invent its own rule logic.

---

# 9. QUALITY TIERS AND PERFORMANCE

## 9.1 Tier Table

| Parameter | High | Medium | Low |
| :--- | :--- | :--- | :--- |
| Global particle cap | 400 | 150 | 0 |
| Canvas frame target | 60fps | 45fps | 30fps |
| Device pixel ratio cap | 2 | 1.5 | 1 |
| Ambient layers | L0-L5 | L0-L4 (L3 one blob, L5 40%) | L0-L1, L2 static |
| Glow layers per element | 2 | 1 | 1 (static) |
| Route glitch | Full | Full | Scanline only |
| Screen shake | On | On | Off |
| Tilt and spotlight | On | On | Off |
| Piece idle breathing | On | Off | Off |

## 9.2 Auto-Detection

- Initial tier from: `hardwareConcurrency`, `deviceMemory` (when available), `prefers-reduced-motion`, `saveData`, and viewport class.
- Runtime monitor: if 95th percentile frame time exceeds 24ms for 3 continuous seconds, drop one tier. Never step up automatically within a session.
- On auto-downgrade show a toast: "Đã giảm hiệu ứng để giữ độ mượt" with a link to Settings.
- Manual choice in Settings (Tự động, Cao, Vừa, Thấp) overrides auto-detect and persists.

## 9.3 Budgets and Constraints

| Item | Limit |
| :--- | :--- |
| Effect main-thread cost, High tier | at most 4ms per frame |
| Full-screen blur layers | at most 1 at any time |
| Animated properties | transform and opacity only. No animated box-shadow, filter blur or layout properties on many elements |
| Effects rendering | One shared 2D canvas overlay. No WebGL. No video |
| New dependencies | None unless justified in writing and at most 30KB gzip each |
| Added JS for VFX plus audio engine | at most 60KB gzip |
| BGM files | Lazy-loaded after first interaction. Total at most 5MB |
| Fonts | Subset and preload the display font |
| Login background | Static poster image first paint, animation starts after load |

Gameplay priority: board input latency and state updates are never queued behind effects.

---

# 10. AUDIO

## 10.1 SFX (synthesized with WebAudio, no files)

| ID | Character |
| :--- | :--- |
| ui_hover | Very soft tick |
| ui_click | Short crisp click |
| ui_confirm | Two-note rising blip |
| ui_error | Low short buzz |
| select | Light pluck |
| move | Short slide blip |
| capture | Noise burst plus downward sweep plus low thump |
| goal_warning | Heartbeat loop |
| low_time_tick | Dry tick under 10s |
| match_found | Rising sweep plus hit |
| countdown_tick / countdown_go | Pitched blip (3, 2, 1) / higher accent |
| victory | Rising arpeggio |
| defeat | Falling slide |
| elo_tick / rank_up | Fast tick per 10 points / bright chord |

## 10.2 Background Music

| Item | Rule |
| :--- | :--- |
| Style | Synthwave, royalty-free, loops |
| Tracks | `lobby_loop` and `match_loop`, crossfade 800ms |
| Location | `/public/audio/bgm/` |
| Attribution | `ATTRIBUTION.md` MUST list title, author, source URL and license for every track |
| Default | OFF, with a one-time invitation "Bật nhạc nền?" on first Home visit |
| Ducking | BGM ducks 6dB during capture, VS and Result stingers |

## 10.3 Behavior

- Audio context starts after the first user gesture. Autoplay failure is silent (06 §6).
- Settings: master mute, SFX toggle, BGM toggle, two volume sliders. Persisted.
- Defaults: SFX 70%, BGM 35%. Peak level normalized to about -3 dBFS.
- Audio is never the only feedback channel. Every sound has a visual counterpart.

---

# 11. ELO RANK DISPLAY (display only)

Derived on the client from Elo. Not stored, not sent to the backend. Thresholds live in one config constant and are tunable.

| Tier (VN) | Elo range | Badge color |
| :--- | :--- | :--- |
| Đồng | below 1100 | #C97B4A |
| Bạc | 1100-1249 | #B8C4D6 |
| Vàng | 1250-1399 | #FFC94A |
| Bạch Kim | 1400-1549 | #5EF2D6 |
| Kim Cương | 1550-1699 | #6FA8FF |
| Huyền Thoại | 1700 and above | LEGEND gradient |

Badge is a neon vector shield with 1-3 chevrons. Tier is identifiable by shape as well as color. Shown on Profile, VS and Result (Ranked only). Guest and Unranked modes show no rank.

---

# 12. COPY VOICE (VIETNAMESE)

Rule: hype for primary CTAs and big moments. Neutral for forms, settings and errors. No emoji in UI copy.

| Context | Text |
| :--- | :--- |
| Primary queue CTA | TÌM TRẬN |
| Cancel queue | Huỷ tìm trận |
| Match found | ĐÃ TÌM THẤY ĐỐI THỦ / VÀO TRẬN! |
| Capture feed | "Đấm đã ăn Kéo" |
| Goal tension, attacker | SẮP CHẠM ĐÍCH! |
| Goal tension, defender | NGUY HIỂM: CHẶN ĐƯỜNG! |
| Win / Loss | CHIẾN THẮNG / THUA CUỘC |
| Rematch / Back | ĐẤU LẠI / Về sảnh |
| Forms | Neutral: "Đăng nhập", "Mật khẩu", errors state what happened and the next action |
| Piece names | Đấm, Bao, Kéo |

---

# 13. MOBILE

## 13.1 Layout

| Orientation | Game layout |
| :--- | :--- |
| Landscape (priority) | Compact desktop layout: left column with opponent capsule, clocks and own capsule, board centered sized by height within safe areas, right column move log collapsed to the last 3 moves with a drawer |
| Portrait | Minimal: opponent capsule on top, board at full width, own capsule below, move log as bottom sheet. One-time dismissible hint "Xoay ngang để chơi rộng hơn" |

## 13.2 Touch Targets

Nine cells cannot reach 44px on phone widths (about 38-40px). Board cells are an explicit exception to the 44px rule, with these mitigations:

- Legal-move dots at least 14px.
- Selected piece scales 1.08 with ring.
- Tapping another friendly piece switches selection. Tapping an illegal empty cell does nothing except a small shake.
- No hover dependency anywhere.

Tier defaults on phones are typically Medium or Low. Login shows the static poster background with reduced layers.

---

# 14. ACCESSIBILITY AND SAFETY

| Mode | Behavior |
| :--- | :--- |
| Reduced Motion | Glitch becomes 150ms fade. Shake off. Particles off except static glow. Pulses static. Count-up instant. Tilt and spotlight off |
| Color-blind | Side motif retained, glyph shapes distinct, goal tiles carry a target glyph, rank badges differ by shape |
| Contrast | Text at least 4.5:1. Glyph on token at least 3:1 |
| Focus | Cyan focus ring retained on all controls |
| Photosensitivity | 06B §6.3 rules enforced |

---

# 15. SPECIAL BEHAVIORS

- Spectator: canonical orientation, Blue at bottom, Red HUD on top, full VFX but no selection feedback.
- Disconnect and server interruption overlays (06 §38): dim VFX and audio, never look like a win or loss.
- AI and Offline modes reuse the same board and VFX. Offline handoff overlay keeps the glitch-style transition.

---

# 16. ACCEPTANCE CRITERIA

## Global

- [ ] Every screen in §7 follows its composition contract in Dark and Light themes.
- [ ] No emoji is used for pieces or UI decoration. Glyphs are vector.
- [ ] Blue and Red are used only for side identity.
- [ ] No bounce or elastic motion exists anywhere.
- [ ] Reduced Motion mapping (§14) works on all screens.
- [ ] No effect delays game state, input or clocks.

## Board and Gameplay

- [ ] The three glyphs are distinguishable at 28px.
- [ ] Selected, legal, capture-target and blocked states are visually distinct.
- [ ] VFX-03 runs 600-900ms and canonical state is already updated when it starts.
- [ ] Goal tension shows correct levels from canonical state, ends when the threat ends, and never strobes above 2Hz.
- [ ] Spectator and Red-orientation views keep correct coordinates.

## Performance

- [ ] Auto-detect picks a tier and downgrades after 3s of poor frame time.
- [ ] Manual tier override persists.
- [ ] Low tier has zero canvas particles and no shake.
- [ ] Tab hidden pauses effects.
- [ ] Bundle budgets in §9.3 are met.

## Audio

- [ ] Every SFX in §10.1 exists and is synthesized.
- [ ] BGM defaults OFF, toggles work, `ATTRIBUTION.md` covers every track.
- [ ] Blocked autoplay never shows an error.

## Rank and Copy

- [ ] Rank tiers derive from Elo on the client only, from a single config constant.
- [ ] Non-Ranked results show no Elo card.
- [ ] Copy follows the §12 voice.

## Cut Line (if time is short)

Ship all P0 first. P1 next. P2 only if time remains. P0 is the minimum "Neon Esports Arena" experience: tokens and theme, UI kit, ambient background, VFX and audio engines, quality tiers, pieces and board, gameplay feel, VS, Result, Home, Auth.

---

# 17. TUNABLE VALUES (not blockers)

Exact hex tuning, rank thresholds, particle counts, glow radii, glyph artwork details, BGM track choice (to be supplied by the project owner), easing curve values, tier detection thresholds.

