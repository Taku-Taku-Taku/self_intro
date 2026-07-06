# Taku_Taku_Taku Portfolio

## 概要
Taku_Taku_Takuの自己紹介・ポートフォリオサイト

https://taku-taku-taku.com/ で公開（GitHub Pages + 独自ドメイン）

軽量かつ読みやすいデザインを意識

## プロジェクト構成
### ファイル一覧
- index.html：ページ本体（ヒーロー / Profile / What I Do / Club / Works / Link / Contact）
- style.css：サイト全体のデザイン（配色・余白はCSSカスタムプロパティでトークン管理）
- ink.js：ヒーロー背景のインク水彩にじみ演出（WebGL / 依存ライブラリなし）
- blue_water_lily_edit_large.jpg：プロフィール画像（画質そのまま）
- blue_water_lily_fabicon.png：ファビコン画像（画質低め）
- CNAME：独自ドメイン設定用

### 主な特徴
- 軽量構造：HTML + CSS + 最小限のJavaScriptで構成（JSはヒーロー背景の演出のみ・依存ライブラリなし）
- セマンティックHTML：`header` / `main` / `section` / `footer` による文書構造
- OGP / Twitterカード対応：SNS共有時に適切なタイトル・説明・画像を表示
- 構造化データ（JSON-LD）対応：検索エンジンに人物情報を伝達
- セキュリティ対策：
  - 外部リンク（`target="_blank"`）すべてに `rel="noopener noreferrer"` を付与
  - メールアドレスは Base64 エンコードで直接収集されにくい形に
- パフォーマンス：Webフォントは使用ウェイト（400/500/700）のみ読み込み、画像は `width`/`height` 指定でレイアウトシフトを防止

### デザイン
- カラーはアイコン（クロード・モネ『睡蓮』モチーフ）に合わせた青緑系
- ヒーロー背景はインクが水彩のように溶け合う演出（`ink.js`）
  - 素のWebGLフラグメントシェーダー（fbmノイズ＋ドメインワープ）で実装
  - `prefers-reduced-motion` 指定時・WebGL非対応時は静的グラデーションにフォールバック
  - 低解像度レンダリング＋30fps上限＋画面外/タブ非表示で描画停止（モバイルの電池・発熱対策）

## 使用技術
- HTML
- CSS
- JavaScript（WebGL）

## デプロイ
`main` ブランチへの push で GitHub Pages に自動反映
