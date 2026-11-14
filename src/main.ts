import Phaser from 'phaser';
import { CafeScene } from './scene';
import { hooks, showMenu } from './ui';

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#1c1420', pixelArt: true, antialias: false, roundPixels: true, audio: { noAudio: true },
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, input: { keyboard: false, gamepad: false }, scene: [],
});
game.scene.add('cafe', CafeScene);
hooks.set(() => { game.scene.start('cafe'); }, () => { game.scene.stop('cafe'); });
showMenu();
(window as any).__game = game; import('./app').then(m => ((window as any).__app = m.app));
