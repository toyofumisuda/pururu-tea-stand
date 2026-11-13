# ぷるる茶房 PURURU TEA STAND（Web制作の見本サイト）

架空のタピオカ・ティードリンク専門店の1ページLPです。※実在の店舗ではありません。

- Three.js で、コードだけで作ったタピオカドリンクの3D（スクロールで味と色が切り替わる）
- 甘さ・氷・トッピングを選ぶと3Dカップと金額が変わるシミュレーター
- 動きを減らす設定・WebGL非対応のときは SVG イラストに切り替え（`?static` を付けると確認できる）
- 素の HTML / CSS / JavaScript（ビルド不要）

## ファイル
- `index.html` … ページ本体（OGP・お問い合わせフォームの送信先もここ）
- `css/style.css` … 見た目（色は `:root` で管理）
- `js/main.js` … メニュー・ギャラリー・カスタマイズ・フォームの動き、SVGイラスト
- `js/three-scene.js` … 3Dドリンク

## お問い合わせフォーム
`index.html` の `action="https://formspree.io/f/YOUR_FORM_ID"` の ID を Formspree で作ったものに書き換えると送信できます。
