/**
 * Relie le volant, les touches et la réparation aux commandes de la place pilote.
 * Liens : client-phone/pilot/wheelSensor.ts, client-shared/controls.ts.
 */
import type { GameState, Team } from '../../server/types.js';
import { createControls } from '../../client-shared/controls.js';
import { holdButton, actionButton } from '../ui/press.js';
import type { PhoneSession } from '../session.js';
import { shouldSendInput, type SentInput } from './gyro.js';
import { PilotViewport } from './views/PilotViewport.js';
import { WheelSensor, type WheelStatus } from './wheelSensor.js';

const instructions: Record<WheelStatus, string> = {
  touch: 'Maintiens une flèche pour tourner ou active le volant.',
  waiting: 'Tiens ton téléphone devant toi, comme un volant.',
  calibrating: 'Garde le volant droit pendant la calibration.',
  ready: 'Incline le téléphone pour tourner.',
  missing: 'Capteur indisponible. Utilise les flèches.',
  denied: 'Accès au capteur refusé. Utilise les flèches.',
  http: 'Le volant nécessite une connexion HTTPS. Utilise les flèches.',
};

export class PilotScreen {
  readonly root = document.createElement('section');
  private readonly viewport: PilotViewport;
  private readonly wheel = new WheelSensor();
  private readonly status = document.createElement('p');
  private readonly input;
  private readonly sensor;
  private readonly calibrate;
  private readonly auto;
  private readonly repair;
  private readonly right;
  private readonly left;
  private readonly pedal;
  private readonly direction = document.createElement('div');
  private readonly timer: number;
  private wakeLock: WakeLockSentinel | null = null;
  private closed = false;
  private active = false;
  private state: GameState | null = null;
  private leftHeld = false;
  private rightHeld = false;
  private pedalHeld = false;
  private last: SentInput = { time: -Infinity, steer: 0, throttle: 0 };

  constructor(private readonly session: PhoneSession, private readonly team: Team) {
    this.viewport = new PilotViewport(team, () => session.sync.now());
    this.root.className = 'pilot-screen';
    this.input = createControls(msg => session.send(msg));
    this.sensor = actionButton('Activer le volant', () => { void this.activate(); });
    this.calibrate = actionButton('Calibrer', this.wheel.calibrate);
    this.auto = actionButton('Avance auto', () => session.send({ type: 'ToggleDriveMode', team }));
    this.repair = holdButton('Réparer', on => session.send({ type: 'PadHold', team, role: 'pilot', on }));
    this.left = holdButton('↶ Gauche', held => { this.leftHeld = held; });
    this.right = holdButton('Droite ↷', held => { this.rightHeld = held; });
    this.pedal = holdButton('Accélérer', held => { this.pedalHeld = held; });
    this.status.setAttribute('role', 'status');
    this.status.className = 'detail';
    const settings = document.createElement('div');
    settings.className = 'pilot-settings';
    settings.append(this.sensor, this.calibrate, this.auto);
    this.direction.className = 'pilot-direction';
    this.direction.append(this.left.button, this.right.button);
    this.root.append(this.viewport.root, this.status, this.direction, this.pedal.button, this.repair.button, settings);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.release);
    this.timer = window.setInterval(() => this.step(performance.now()), 1000 / 60);
    void this.keepAwake();
  }

  /** Met les commandes à jour avec le poste, la phase de course et le mode de conduite. */
  update(state: GameState): void {
    this.state = state;
    this.viewport.update(state, this.session.stateTime);
    const active = this.session.canPlay && state.phase === 'RACE' && !document.hidden;
    if (this.active && !active) this.release();
    this.active = active;
    this.refreshControls();
  }

  /** Détache les contrôles et le capteur en quittant la course ou la place. */
  close(): void {
    this.release();
    this.closed = true;
    clearInterval(this.timer);
    this.wheel.close();
    this.viewport.close();
    void this.wakeLock?.release().catch(() => {});
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.release);
    this.root.remove();
  }

  /** Envoie une commande rafraîchie uniquement dans les états de jeu autorisés. */
  private step(now: number): void {
    const sensor = this.wheel.read(now);
    this.refreshControls();
    if (!this.active || document.hidden) return;
    const pedal = this.state?.driveMode[this.team] === 'pedal';
    const input = {
      steer: this.wheel.status === 'ready' ? sensor.steer : Number(this.rightHeld) - Number(this.leftHeld),
      throttle: pedal ? Math.max(Number(this.pedalHeld), sensor.throttle) : 1,
    };
    if (!shouldSendInput(now, input, this.last)) return;
    this.input.steer(this.team, input.steer, input.throttle);
    this.last = { ...input, time: now };
  }

  /** Met les repères tactiles à jour sans recréer un bouton en cours de maintien. */
  private refreshControls(): void {
    const status = this.wheel.status;
    const ready = status === 'ready';
    const calibrating = status === 'waiting' || status === 'calibrating';
    const pedal = this.state?.driveMode[this.team] === 'pedal';
    const hint = this.state?.phase === 'PAUSED' ? 'Partie en pause.'
      : this.state?.tutorial?.steps[this.state.tutorial.teams[this.team].step] === 'identify'
        ? 'Maintiens Réparer pour confirmer ton poste.' : instructions[status];
    if (this.status.textContent !== hint) this.status.textContent = hint;
    this.sensor.hidden = ready || calibrating;
    this.sensor.textContent = status === 'touch' ? 'Activer le volant' : 'Réessayer le capteur';
    this.calibrate.hidden = !ready;
    this.direction.hidden = ready;
    this.pedal.button.hidden = !pedal;
    this.auto.textContent = pedal ? 'Mode pédale' : 'Avance auto';
    this.auto.setAttribute('aria-pressed', String(!pedal));
    for (const button of [this.left.button, this.right.button, this.pedal.button, this.auto, this.repair.button]) {
      button.disabled = !this.active;
    }
  }

  /** Active le capteur à la demande du joueur et tente de garder l'écran en paysage. */
  private async activate(): Promise<void> {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (mode: string) => Promise<void> }) | undefined;
    const activation = this.wheel.activate();
    void orientation?.lock?.('landscape').catch(() => {});
    await activation;
    this.refreshControls();
  }

  /** Neutralise les entrées avant un changement d'application ou de phase. */
  private release = (): void => {
    this.left.release();
    this.right.release();
    this.pedal.release();
    this.repair.release();
    this.input.steer(this.team, 0, 0);
    this.last = { time: -Infinity, steer: 0, throttle: 0 };
  };

  /** Reprend la calibration et la veille de l'écran au retour au premier plan. */
  private onVisibility = (): void => {
    if (document.hidden) this.release();
    else {
      if (['waiting', 'calibrating', 'ready'].includes(this.wheel.status)) this.wheel.calibrate();
      void this.keepAwake();
    }
    if (this.state) this.update(this.state);
  };

  /** Essaie de garder l'écran allumé pendant la conduite. */
  private async keepAwake(): Promise<void> {
    if (!navigator.wakeLock || this.closed || document.hidden || this.wakeLock?.released === false) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (this.closed) await lock.release();
      else this.wakeLock = lock;
    } catch {
      // La conduite reste disponible même si le navigateur impose la veille.
    }
  }
}
