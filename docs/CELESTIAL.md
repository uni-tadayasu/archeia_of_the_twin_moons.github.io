# CG品質更新 56.3

既存ゲームのキャラクター、技、進行、認証、オンラインAPIを引き継ぎ、表示と戦闘の視覚的なフィードバックを改善する更新です。

## キャラクターの実測

`node scripts/measure-model-quality.mjs --json` は同梱Dracoデコーダーで実GLBを読み、実際の細分化コードを計測します。

| モデル | 元の三角形数 | 高画質 | 最高CG |
| --- | ---: | ---: | ---: |
| hero-swordsman（ロウエン） | 12,414 | 49,656 | 198,624 |
| old-knight | 16,583 | 66,332 | 265,328 |
| iron-warlord（高密度モデル） | 479,060 | 479,060 | 479,060 |

元の頂点・UV・骨・マテリアル区分を保持し、追加した辺の頂点だけを法線に沿って穏やかに曲面補間します。硬い折り目は丸めず、UVの境界は別頂点のまま保持します。対象形状の三角形数上限は高画質90,000、最高CG300,000です。すでに高密度の形状はそのまま描画します。追加ジオメトリの共有キャッシュは96MiB・32件までです。画像テクスチャを作り直したり、元の人物の顔・衣装を別物に置き換える処理ではありません。

## 画像とアイコン

新規CG画像は内蔵画像生成で制作し、ゲーム配信用にWebPへ変換しています。`share.jpg` は宮殿画像の共有カード向けサイズです。透過魔法陣のアルファを維持しています。

| ファイル | 用途 |
| --- | --- |
| `assets/celestial/hero.webp` | タイトル・メニュー・双月系舞台 |
| `assets/celestial/cavern.webp` | 氷晶系舞台・探索カード |
| `assets/celestial/spell-seal.webp` | 詠唱・回復・奥義の透過魔法陣 |
| `assets/celestial/share.jpg` | OGP共有画像 |
| `assets/celestial/mark.svg` | オリジナル双月紋章・ファビコン |
| `assets/celestial-icons.svg` / `.js` | 71種の独自SVGアイコン |

生成プロンプト：

### 宮殿

Use case: stylized-concept. Asset type: premium Japanese fantasy browser RPG title background, landscape 16:9 composition. Create a spectacular original CG illustration of the Citadel of the Twin Moons: an intricately built Japanese fantasy palace above a silver-blue lake, distant mountain terraces, a large ivory moon and smaller blue crescent, lacquered dark wood, carved gold architectural details, quiet amber lanterns, pale moonlit mist and delicate windblown maple leaves. Exquisite physically convincing stone, wood and gold surfaces, cinematic atmospheric depth, sophisticated painterly CG detail, restrained palette of midnight navy, antique gold, ivory and teal. The palace architecture occupies the right two-thirds, lower left is an elegant dark misty terrace with calm negative space for game title and controls. Camera at terrace height, majestic but believable scale, sharp architectural silhouette, luminous reflections, no characters. It must look like polished original game key art, no menu mockup, no text, no logos, no watermark, no frames.

### 氷晶洞窟

Use case: stylized-concept. Asset type: full-screen background illustration for a premium original fantasy action RPG crystal cavern stage, wide 16:9 landscape. Vast subterranean sapphire cathedral shaped by natural geology, enormous translucent aquamarine crystal clusters and dark layered rock archways at the distant sides, gold mineral veins, a few ancient engraved stone ruins integrated naturally into the cavern, reflective shallow pools around the far perimeter, cool shafts of moonlike light descending through narrow fissures, atmospheric mist and subtle floating mineral dust. Foreground and center are broad readable gently worn pale stone ground seen from human eye height; keep central action space uncluttered, distant architecture emphasizes great depth. Exquisite cinematic CG illustration with physically convincing crystal refraction and stone grain, painterly precision, luxurious lighting, soft silver cyan highlights and deep navy shadows, controlled bright highlights so characters remain legible. Original environment, no people, no letters, no UI, no symbols resembling text, no logo, no watermark.

### 双月の魔法陣

Use case: stylized-concept. Asset type: transparent game VFX texture, a single original circular spell seal for the fantasy RPG Archeia of the Twin Moons. Orthographic straight top-down view, perfectly centered, complete circular silhouette inside the canvas with generous transparent margins. Elaborate fine silver-white luminous filigree, two interlocking crescent-moon motifs around a delicate central eight-point compass flower, concentric engraved rings, tiny original abstract arcane notches, elegant ornate radial geometry and a restrained soft glow. Exquisite CG illustration, sharp precise thin lines at the center and soft luminous falloff at outer edges. Monochrome pearl white and silver only so it can be tinted by the game engine. Keep the center mostly transparent and all spaces between lines truly transparent, no filled disc. No pedestal, no scene, no floor, no square panel, no black or colored background, no readable text, no letters, no logo, no watermark.

## 検証範囲

実GLB計測、形状・UV・ウェイト・モーフ、各資源の解放、舞台の有限座標と描画予算、実際の回復・命中と演出の対応を検査します。CIブラウザではPC高画質／スマートフォン軽量の実戦、画像・アイコン、画質切り替え、操作、表示、終了時解放を確認します。最高CGの二段階細分化は実GLB計測とユニットテストで検証します。実端末でのFPSや本番オンライン実戦を保証する測定ではありません。
