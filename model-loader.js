import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './assets/vendor/meshopt_decoder.module.js';

// Keep one decoder pool for fighters and summons so loading every character
// does not create a worker for each GLB. The data uses standard glTF extensions.
const dracoLoader = new DRACOLoader()
  .setDecoderPath(new URL('./assets/vendor/draco/', import.meta.url).href)
  .setDecoderConfig({ type: 'wasm' })
  .setWorkerLimit(2);

export function createModelLoader() {
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .setDRACOLoader(dracoLoader);
}

export function modelAssetUrl(path) {
  const url = new URL(path, import.meta.url);
  url.searchParams.set('v', '20261106-model-ui3');
  return url.href;
}
