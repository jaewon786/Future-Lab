// 3D 대결 화면: 측면에서 본 14m 피스트와 아바타 2개.
// 관절을 그대로 옮기지 않고 상태(위치·런지·팔 뻗기·막기)로 미리 정한 자세를 보간한다 (계획서 1-1).
import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';

export interface FencerView {
  /** 피스트 위치 (m, −7~+7) */
  readonly x: number;
  /** 런지 진행 0~1 */
  readonly lunge: number;
  /** 칼 팔 뻗기 0~1 */
  readonly arm: number;
  readonly parry: boolean;
}

export interface ArenaView {
  readonly user: FencerView;
  readonly opponent: FencerView;
}

export interface Arena {
  /** 다음 프레임부터 이 상태를 향해 부드럽게 움직인다 */
  set(view: ArenaView): void;
  /** 득점 순간 아바타를 잠깐 밝힌다 */
  flash(who: 'user' | 'opponent' | 'double'): void;
  dispose(): void;
  /** WebGL을 못 쓰는 환경이면 false (대결은 HUD만으로 계속된다) */
  readonly available: boolean;
}

interface Avatar {
  readonly root: Group;
  readonly torso: Group;
  readonly frontLeg: Mesh;
  readonly backLeg: Mesh;
  readonly arm: Group;
  readonly material: MeshLambertMaterial;
  readonly baseColor: Color;
}

const SMOOTH = 0.35;
const FLASH_MS = 600;
const FLASH_COLOR = new Color(0xfacc15);

function limb(length: number, radius: number, material: MeshLambertMaterial): Mesh {
  const m = new Mesh(new CylinderGeometry(radius, radius, length, 8), material);
  m.geometry.translate(0, -length / 2, 0); // 위쪽 끝을 관절(회전 중심)로
  return m;
}

/** facing: +1이면 +x(오른쪽)를 본다 */
function makeAvatar(color: number, facing: 1 | -1): Avatar {
  const material = new MeshLambertMaterial({ color });
  const root = new Group();
  const hips = new Group();
  hips.position.y = 0.95;
  root.add(hips);

  const frontLeg = limb(0.95, 0.07, material);
  const backLeg = limb(0.95, 0.07, material);
  hips.add(frontLeg, backLeg);

  const torso = new Group();
  hips.add(torso);
  const body = new Mesh(new CapsuleGeometry(0.17, 0.45, 4, 8), material);
  body.position.y = 0.35;
  const head = new Mesh(new SphereGeometry(0.13, 12, 8), material);
  head.position.y = 0.78;
  torso.add(body, head);

  const arm = new Group();
  arm.position.y = 0.55;
  const upper = limb(0.6, 0.05, material);
  const blade = new Mesh(new BoxGeometry(0.02, 0.9, 0.02), new MeshLambertMaterial({ color: 0xd1d5db }));
  blade.position.y = -1.05;
  arm.add(upper, blade);
  torso.add(arm);

  root.scale.x = facing;
  return { root, torso, frontLeg, backLeg, arm, material, baseColor: new Color(color) };
}

function pose(a: Avatar, v: FencerView): void {
  const lerp = (cur: number, to: number) => cur + (to - cur) * SMOOTH;
  a.root.position.x = lerp(a.root.position.x, v.x);
  // 준비 자세 → 런지: 앞다리는 앞으로, 뒷다리는 뒤로 펴지고 상체가 조금 숙여진다
  a.frontLeg.rotation.z = lerp(a.frontLeg.rotation.z, 0.35 + v.lunge * 0.9);
  a.backLeg.rotation.z = lerp(a.backLeg.rotation.z, -0.35 - v.lunge * 0.6);
  a.root.position.y = lerp(a.root.position.y, -v.lunge * 0.25);
  a.torso.rotation.z = lerp(a.torso.rotation.z, -v.lunge * 0.15);
  // 팔: 내림(0) → 앞으로 수평(1). 막기면 칼을 세운다
  const armTarget = v.parry ? 2.4 : 0.6 + v.arm * 0.97;
  a.arm.rotation.z = lerp(a.arm.rotation.z, armTarget);
}

export function createArena(canvas: HTMLCanvasElement): Arena {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false });
  } catch {
    return { available: false, set() {}, flash() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color(0x0f172a);
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 1.2);
  sun.position.set(2, 6, 5);
  scene.add(sun);

  const piste = new Mesh(new BoxGeometry(14, 0.02, 1.5), new MeshLambertMaterial({ color: 0x334155 }));
  piste.position.y = -0.01;
  scene.add(piste);
  for (const x of [-7, -2, 0, 2, 7]) {
    const line = new Mesh(new BoxGeometry(0.04, 0.025, 1.5), new MeshLambertMaterial({ color: 0xe2e8f0 }));
    line.position.x = x;
    scene.add(line);
  }

  const user = makeAvatar(0x3b82f6, 1);
  const opponent = makeAvatar(0xef4444, -1);
  scene.add(user.root, opponent.root);

  const camera = new PerspectiveCamera(35, 16 / 9, 0.1, 100);
  camera.position.set(0, 1.4, 9);
  camera.lookAt(0, 0.9, 0);

  let view: ArenaView = {
    user: { x: -2, lunge: 0, arm: 0, parry: false },
    opponent: { x: 2, lunge: 0, arm: 0, parry: false },
  };
  const flashUntil = { user: 0, opponent: 0 };

  const resize = () => {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 360;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  };

  renderer.setAnimationLoop((now) => {
    resize();
    pose(user, view.user);
    pose(opponent, view.opponent);
    // 두 사람 가운데를 따라가도록 카메라를 옮긴다
    const mid = (user.root.position.x + opponent.root.position.x) / 2;
    camera.position.x += (mid - camera.position.x) * 0.1;
    camera.lookAt(camera.position.x, 0.9, 0);
    for (const [a, until] of [
      [user, flashUntil.user],
      [opponent, flashUntil.opponent],
    ] as const) {
      a.material.color.copy(a.baseColor);
      if (now < until) a.material.color.lerp(FLASH_COLOR, 0.7);
    }
    renderer.render(scene, camera);
  });

  return {
    available: true,
    set(next) {
      view = next;
    },
    flash(who) {
      const until = performance.now() + FLASH_MS;
      if (who !== 'opponent') flashUntil.user = until;
      if (who !== 'user') flashUntil.opponent = until;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
  };
}
