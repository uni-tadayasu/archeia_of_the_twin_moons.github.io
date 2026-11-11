/* V55.6 compatibility module. Replaced the legacy auto scanner to avoid
   competing WebGL previews; the unified card scanner is in rf556-model-portraits.js.
   Keep the public getExactWebp export for existing callers. */
import {FIGHTERS} from './data.js?v=rf-minamoto-v48-20261111';
import {loadModel} from './model-runtime.js?v=rf-minamoto-v48-20261111';
import {renderExactPortrait} from './glb-portrait.js?v=rf-mobile-v7-20261109';
export async function getExactWebp(key){
 if(!FIGHTERS[key]?.model)throw Error('モデルがありません');
 if(window.RF556Portraits?.get)return window.RF556Portraits.get(key);
 return renderExactPortrait(await loadModel(FIGHTERS[key].model),key);
}
