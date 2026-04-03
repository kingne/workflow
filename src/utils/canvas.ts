type PathTarget = Pick<
  CanvasRenderingContext2D | Path2D,
  | "moveTo"
  | "lineTo"
  | "quadraticCurveTo"
  | "closePath"
  | "arc"
>;

export function createRoundedRectPath(
  target: PathTarget,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const boundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  target.moveTo(x + boundedRadius, y);
  target.lineTo(x + width - boundedRadius, y);
  target.quadraticCurveTo(x + width, y, x + width, y + boundedRadius);
  target.lineTo(x + width, y + height - boundedRadius);
  target.quadraticCurveTo(x + width, y + height, x + width - boundedRadius, y + height);
  target.lineTo(x + boundedRadius, y + height);
  target.quadraticCurveTo(x, y + height, x, y + height - boundedRadius);
  target.lineTo(x, y + boundedRadius);
  target.quadraticCurveTo(x, y, x + boundedRadius, y);
  target.closePath();
}
