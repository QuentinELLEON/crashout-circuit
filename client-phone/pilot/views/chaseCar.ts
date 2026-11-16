/** Compose la silhouette et la traînée de la voiture suivie au premier plan. */

/** Dessine la voiture de poursuite après tous les objets du monde. */
export function drawChaseCar(ctx: CanvasRenderingContext2D, w: number, h: number,
  y: number, color: string, steer: number, boosting: boolean): void {
  const size = Math.min(w * .22, h * .29);
  ctx.save();
  ctx.translate(w / 2, y);
  if (boosting) {
    const trail = ctx.createLinearGradient(0, -size * .1, 0, size * .65);
    trail.addColorStop(0, color);
    trail.addColorStop(1, '#ffffff00');
    ctx.fillStyle = trail;
    ctx.fillRect(-size * .25, -size * .1, size * .5, size * .7);
  }
  ctx.fillStyle = '#0008';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * .61, size * .14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(Math.max(-1, Math.min(1, steer)) * 8 * Math.PI / 180);
  ctx.fillStyle = '#141b21';
  ctx.fillRect(-size * .57, -size * .38, size * .23, size * .37);
  ctx.fillRect(size * .34, -size * .38, size * .23, size * .37);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * .5, -size * .12);
  ctx.lineTo(-size * .42, -size * .49);
  ctx.lineTo(-size * .26, -size * .66);
  ctx.lineTo(size * .26, -size * .66);
  ctx.lineTo(size * .42, -size * .49);
  ctx.lineTo(size * .5, -size * .12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#263642';
  ctx.fillRect(-size * .26, -size * .57, size * .52, size * .2);
  ctx.fillStyle = '#f56b71';
  ctx.fillRect(-size * .45, -size * .25, size * .2, size * .09);
  ctx.fillRect(size * .25, -size * .25, size * .2, size * .09);
  ctx.restore();
}
