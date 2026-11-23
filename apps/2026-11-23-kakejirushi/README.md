# 掛け印 / KAKEJIRUSHI

個展、学園祭・学校の作品展、小規模ギャラリー向けの**壁面展示計画と現場実測の照合**アプリ。2026-11-23制作。MIT。

## 選定理由と市場・競合
- 日本: [国立アートリサーチセンター 2025年度美術館意識調査（2026-05-20）](https://ncar.artmuseums.go.jp/reports/20260520.html)／[文化庁事業の日本美術市場調査（2026-02-26発表、2024年の売上推計1,031億円）](https://prtimes.jp/main/html/rd/p/000000024.000093369.html)。※展示設営アプリへの需要や支払意思を示す数字ではない。
- 海外: [Art Basel/UBS 2026年版報告](https://www.artbasel.com/stories/the-art-basel-and-ubs-global-art-market-report-2026) は2025年世界の美術市場を596億米ドル、前年比4%増と推計。※アプリ市場規模ではない。
- 国内競合: [ArtHang](https://meisaiokamoto.com/en/arthang/) は寸法配置やビス位置/PDF、[Atelier Board](https://atelierboard.art/) は制作管理と壁面レイアウト、[Gallerydraft](https://gallerydraft.com/) は3D展示計画。
- 海外競合: [ArtPlacer](https://www.artplacer.com/art-fair-planner/)、[GaleristA](https://galerista.pro/)、[OSS Gallery Wall Planner](https://github.com/samG4/gallery-wall-planner) はレイアウト・取付位置・ローカル運用まで対応する。これらの機能だけでは独自性とは言えない。

**差別化仮説**: 計画と搬入日の照合作業を一続きに扱い、作品間隔・壁外・重複の検査、フック位置の実測誤差と許容差照合、配置変更による古い実測・確認状態の失効を一画面で提供する。需要・収益性・優位性は未検証。

## 実装
作品追加・複製・削除とドラッグ移動、数値編集、自動整列、警告、単一点のフック位置（左・上・床から）、実測入力・±許容差・設置チェック、Undo、JSON入出力、CSV/SVG出力、印刷、localStorage自動保存、スマホ対応。登録・外部CDN/API・課金・外部HTTP要求なし。氏名など個人情報入力不要。

## 起動とソース
このGitHubフォルダの `index.html` は、完全版 `standalone.html` を**gzip圧縮・base64格納した単一HTMLローダー**。Chromiumで起動表示を検証した。モダンブラウザの `DecompressionStream('gzip')` が必要。`python3 unpack.py` で完全に可読な `standalone.html` に復元できる。展開されたHTMLのSHA-256は `49becb0b67d45c4746fc0b0abecfcb91ee4f3420160ed0d77c131462d04caee3` 。別途提供するZIPには、可読な分割ソース（`core.js`, `app.js`, `style.css`, `index.html`）・テスト・画面画像を含む。

## 検証と限界
- Node.js 22: **21/21** 単体テスト成功、うち固定シード500配置ケース。
- Chromium 144: 完全版を `set_content` でインライン実行して **25/25操作チェック成功**。外部HTTP 0、JavaScript例外 0。
- GitHub用gzipローダーのChromiumでの復元と初期画面描画も確認。
- 管理環境での `file://` 直接遷移は管理者ポリシーでブロックされた。端末保存はテストでメモリ模擬。実環境の直接起動・印刷・耐荷重・安全施工は未検証。
- 中央一点吊りモデルのみ。ワイヤー、二点吊り、壁材、下地、重量、施工安全を保証しない。整列は幾何的な近似。

**保存先:** `hourly-app-lab/apps/2026-11-23-kakejirushi/` 。`main` および既存サイトを変更しない。
