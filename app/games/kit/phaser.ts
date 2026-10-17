// Phaser plumbing shared by the arcade games. Only Phaser games import this, so Phaser stays in their chunks.
import * as Phaser from 'phaser';
import type { ShallowRef } from 'vue';
import type { Player } from '~/games/types';

export { Phaser };

export const FONT = 'system-ui, sans-serif';

/** '#ff9f1c' → 0xff9f1c */
export const hex = (css: string) => Phaser.Display.Color.HexStringToColor(css).color;

export const addText = (scene: Phaser.Scene, x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
  scene.add.text(x, y, text, { fontFamily: FONT, ...style });

/**
 * A player on the field: shadow, circle in their colour (optional ring, e.g. the team colour), avatar, name below.
 * Positioned by the circle's centre.
 */
export function addPlayerToken(scene: Phaser.Scene, p: Player, x: number, y: number, { r = 22, ring = 0xffffff } = {}) {
  return scene.add.container(x, y, [
    scene.add.ellipse(0, r * 0.9, r * 1.8, r * 0.55, 0x000000, 0.3),
    scene.add.circle(0, 0, r, hex(p.color)).setStrokeStyle(3, ring),
    addText(scene, 0, 0, p.avatar, { fontSize: `${Math.round(r * 1.25)}px` }).setOrigin(0.5),
    addText(scene, 0, r + 12, p.name, { fontSize: '20px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5),
  ]);
}

/**
 * Creates the Phaser game in `parent` once the component is mounted and destroys it on unmount.
 * Defaults: 1600×900 scaled to FIT the stage, keyboard off (the host page owns the keyboard).
 */
export function usePhaserGame(parent: Readonly<ShallowRef<HTMLElement | null>>, config: Omit<Phaser.Types.Core.GameConfig, 'parent'>) {
  let game: Phaser.Game | undefined;
  onMounted(() => {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 1600,
      height: 900,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: false },
      ...config,
      parent: parent.value ?? undefined,
    });
  });
  onUnmounted(() => game?.destroy(true));
}
