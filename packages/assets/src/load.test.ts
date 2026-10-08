import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, test } from "vitest";

import { findSignAnchors, prepareModel } from "./load";

describe("loading a model", () => {
  test("[R-ASSET-005] given a model whose materials lost flat shading in compression, when the loader prepares it, then every material is flat shaded", () => {
    const root = new Group();
    const a = new MeshStandardMaterial({ flatShading: false });
    const b = new MeshStandardMaterial({ flatShading: false });
    root.add(new Mesh(new BoxGeometry(), a));
    const child = new Group();
    child.add(new Mesh(new BoxGeometry(), [b, a]));
    root.add(child);
    prepareModel(root);
    expect(a.flatShading).toBe(true);
    expect(b.flatShading).toBe(true);
  });

  test("[R-ASSET-012] given a model whose node extras carry sign anchors, when the loader looks for them, then it finds the text keys, not words", () => {
    const root = new Group();
    const node = new Group();
    node.userData = { signs: [{ key: "place.ojuelegba.sign.1", centre: [0, 3, 2], width: 3, height: 0.7, ry: 0, style: { board: "blue", ink: "white" } }] };
    root.add(node);
    expect(findSignAnchors(root).map((sign) => sign.key)).toEqual(["place.ojuelegba.sign.1"]);
  });
});
