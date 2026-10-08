// Many copies of one model as one draw call per part: the place budget counts a building or a prop
// once however many stand in view (assets.md R-ASSET-007, the build check's count).
import { Group, InstancedMesh, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from "three";

/** x, z and the turn about +Y. */
export type Placement = readonly [number, number, number];

/** One instanced mesh for each mesh in `model`, a copy at each placement. Shares the model's geometry and materials. */
export function instanceModel(model: Object3D, placements: readonly Placement[], name: string): Group {
  const group = new Group();
  group.name = name;
  model.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(model.matrixWorld).invert();
  const place = new Matrix4();
  const local = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const turn = new Quaternion();
  const one = new Vector3(1, 1, 1);
  model.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    local.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const copies = new InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach(([x, z, ry], index) => {
      place.compose(new Vector3(x, 0, z), turn.setFromAxisAngle(up, ry), one);
      copies.setMatrixAt(index, place.clone().multiply(local));
    });
    copies.computeBoundingSphere();
    copies.name = mesh.name;
    group.add(copies);
  });
  return group;
}
