export const STORY_II = [
  {
    title: '一の関　鈴のない門', stage: 'bamboo', opponent: 'tsubaki', cpu: .54, hp: .66, attack: .78,
    before: [['門番のツバキ', '月が欠けるたび、ここから先の道がひとつ消える。灯を運ぶなら、私の間合いを越えてみな。'], ['旅人', '道が消える前に渡る。鈴は、戻ってから鳴らそう。']],
    after: [['門番のツバキ', '抜けな。砂の橋まで、灯を落とすんじゃないよ。']],
  },
  {
    title: '二の関　風を断つ石橋', stage: 'desert', opponent: 'garou', cpu: .63, hp: .70, attack: .86,
    before: [['橋守のガロウ', 'この橋を渡した灯が、向こう岸から返ったことは一度もない。'], ['旅人', 'それなら私が、帰りの目印を残していく。']],
    after: [['橋守のガロウ', '見てろ。向こうの灯が点くまで、ここで風を見張ってやる。']],
  },
  {
    title: '三の関　霜灯の誓い', stage: 'frost', opponent: 'minase', cpu: .72, hp: 1.02, attack: .93,
    before: [['霜を綴るミナセ', '消えた道の名を、全部ここに書き留めたの。最後のページだけ、凍って開かない。'], ['旅人', '開くまで灯を掲げる。手を貸してほしい。']],
    after: [['霜を綴るミナセ', '「天秤の間」。やっと読めた。ここからは、君の足で行ける。']],
  },
  {
    title: '終の関　双月の天秤', stage: 'heaven', opponent: 'seraphel', cpu: .82, hp: .58, attack: .96, boss: true,
    before: [['裁定者セラフェル', '片方の月を残せば、道は永く保たれる。二つとも望むなら、その灯を賭けよ。'], ['旅人', '一つで照らせる岸なら、二つ目は帰る人のために残す。']],
    after: [['裁定者セラフェル', '秤は傾かぬ。両岸に灯を置いてゆけ。'], ['旅人', '竹林まで戻ったら、あの鈴を鳴らそう。']],
  },
];

export const STORY_II_LANE_HALF = 10.5;

export function readStoryII(value) {
  const chapter = value?.chapter;
  return {chapter: Number.isSafeInteger(chapter) ? Math.max(0, Math.min(STORY_II.length, chapter)) : 0};
}

export function configureStoryIIBattle(THREE, battle) {
  const camera = new THREE.OrthographicCamera(-6, 6, 3, -3, .1, 100);
  let center = 0;
  let halfHeight = 0;
  let eye = 0;
  const lane = {
    camera,
    stage: null,
    input(input) {
      if (input.mz === 0 && input.mx >= -1 && input.mx <= 1) return input;
      return {...input, mx: Math.max(-1, Math.min(1, input.mx || 0)), mz: 0};
    },
    resolve(fighter) {
      const edge = Math.max(.5, STORY_II_LANE_HALF - fighter.radius);
      if ((fighter.pos.x <= -edge && fighter.vel.x < 0) || (fighter.pos.x >= edge && fighter.vel.x > 0)) fighter.vel.x = 0;
      fighter.pos.x = Math.max(-edge, Math.min(edge, fighter.pos.x));
      fighter.pos.z = fighter.vel.z = 0;
    },
    facing(fighter) {
      const other = battle.nearestEnemy(fighter);
      const delta = other ? other.pos.x - fighter.pos.x : 0;
      return Math.abs(delta) > .001 ? Math.sign(delta) * Math.PI / 2 : fighter.facing;
    },
    updateCamera(dt) {
      if (!battle.fighters.length) return;
      let left = Infinity, right = -Infinity, top = 0;
      for (const fighter of battle.fighters) {
        left = Math.min(left, fighter.pos.x - fighter.radius);
        right = Math.max(right, fighter.pos.x + fighter.radius);
        top = Math.max(top, fighter.y + (fighter.def.height || 1.8) * fighter.scale);
      }
      const aspect = Math.max(.2, battle.camera.aspect || 1);
      const blend = dt > 0 && halfHeight ? 1 - Math.exp(-8 * dt) : 1;
      center += ((left + right) / 2 - center) * blend;
      const requiredHeight = Math.max(2.95, top * .56 + .7, (Math.max(center - left, right - center) + 1.3) / aspect);
      halfHeight = Math.max(requiredHeight, halfHeight + (requiredHeight - halfHeight) * blend);
      const targetEye = Math.max(top * .52, halfHeight * .26);
      eye += (targetEye - eye) * blend;
      const halfWidth = halfHeight * aspect;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.position.set(center, eye, 18);
      camera.lookAt(center, eye, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    },
  };
  battle.storyII = lane;
  lane.updateCamera(0);
  return lane;
}

export function createStoryIIStage(THREE, stage) {
  const group = new THREE.Group();
  group.name = 'Story II · 月渡りの舞台';
  const stone = new THREE.MeshStandardMaterial({color: new THREE.Color(stage.floor).multiplyScalar(.63), roughness: .87});
  const base = new THREE.MeshStandardMaterial({color: new THREE.Color(stage.pillar).multiplyScalar(.37), roughness: .93});
  const lacquer = new THREE.MeshStandardMaterial({color: new THREE.Color(stage.rim).lerp(new THREE.Color(0x703031), .42), roughness: .49, metalness: .10});
  const trim = new THREE.MeshStandardMaterial({color: new THREE.Color(stage.rim), metalness: .46, roughness: .41});
  const light = new THREE.MeshStandardMaterial({color: 0xffdf93, emissive: stage.crystal, emissiveIntensity: .85, roughness: .44});
  const box = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  box(new THREE.BoxGeometry(22.1, .48, 4.7), base, 0, -.31, -.85);
  box(new THREE.BoxGeometry(21.8, .12, 4.7), stone, 0, -.06, -.85);
  box(new THREE.BoxGeometry(22.04, .035, .12), trim, 0, -.12, 1.52);
  box(new THREE.BoxGeometry(21.9, .055, .16), lacquer, 0, -.42, 1.54);
  const tile = new THREE.BoxGeometry(.045, .27, .05);
  for (let x = -10; x <= 10; x += 2) box(tile, stone, x, -.29, 1.54);

  box(new THREE.BoxGeometry(21.3, .09, .14), lacquer, 0, .48, -2.65);
  box(new THREE.BoxGeometry(21.3, .075, .11), trim, 0, .22, -2.65);
  const post = new THREE.BoxGeometry(.14, .56, .18);
  for (let x = -9; x <= 9; x += 3) box(post, lacquer, x, .28, -2.65);
  const lantern = new THREE.BoxGeometry(.37, .47, .37);
  const cap = new THREE.BoxGeometry(.49, .10, .49);
  for (const x of [-8.4, -4.15, 4.15, 8.4]) {
    box(post, base, x, .28, -2.8);
    box(lantern, light, x, .80, -2.8);
    box(cap, lacquer, x, 1.07, -2.8);
    box(cap, trim, x, .53, -2.8);
  }
  const gatePost = new THREE.BoxGeometry(.23, 2.7, .30);
  const gateBeam = new THREE.BoxGeometry(2.55, .20, .38);
  const gateCrown = new THREE.BoxGeometry(2.87, .09, .44);
  for (const x of [-9.9, 9.9]) {
    box(gatePost, lacquer, x - .94, 1.35, -3.00);
    box(gatePost, lacquer, x + .94, 1.35, -3.00);
    box(gateBeam, lacquer, x, 2.66, -3.00);
    box(gateCrown, trim, x, 2.80, -3.00);
    box(gateBeam, base, x, 2.20, -3.00);
  }
  return {
    group,
    dispose() {
      group.removeFromParent();
      for (const geometry of new Set(group.children.map(mesh => mesh.geometry))) geometry.dispose();
      for (const material of [stone, base, lacquer, trim, light]) material.dispose();
      group.clear();
    },
  };
}
