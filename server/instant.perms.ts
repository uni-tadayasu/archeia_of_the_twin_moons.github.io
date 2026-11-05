// InstantDB のアクセス権限。`npx instant-cli push perms` で反映。
// 招待コード・同期セーブ・購入記録はクライアントから一切読めず書けない（サーバーの管理トークンのみ）。
// それ以外の名前空間も既定で拒否する。リアルタイム通信（rooms / presence / topics）は権限の対象外のため、
// 乱入は署名付き許可証、ダメージは署名付きプロフィールで受信側が検証する。
const deny = { view: 'false', create: 'false', update: 'false', delete: 'false' };

const rules = {
  opinvites: { allow: deny },
  syncsaves: { allow: deny },
  entitlements: { allow: deny },
  // 運営長の特別イベント：誰でも読める。書き込みは可能だが、受信側が運営長の署名トークンを検証する
  chiefevents: { allow: { view: 'true', create: 'true', update: 'true', delete: 'false' } },
  $default: { allow: { $default: 'false' } }
};

export default rules;
