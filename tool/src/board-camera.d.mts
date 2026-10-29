export type Camera = { x: number; y: number; zoom: number; scale: number };
export type Viewport = {
  width: number;
  height: number;
  left: number;
  top: number;
};
export function fitCamera(
  viewport: Pick<Viewport, "width" | "height">,
  board: [number, number],
): Camera;
export function preserveCamera(
  camera: Camera,
  previous: Viewport,
  next: Viewport,
): Camera;
export function cameraViewBox(
  camera: Camera,
  viewport: Pick<Viewport, "width" | "height">,
): [number, number, number, number];
