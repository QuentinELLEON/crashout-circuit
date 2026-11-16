/** Permet de choisir, vérifier et confirmer une pose sans geste à plusieurs doigts. */
import type { GameState, PlacementFailure, PlacementTarget, SeatId, Vec2 } from '../../server/types.js';
import { playerTeam } from '../../client-shared/seatLabels.js';
import { nearestOnTrack, trackTangent } from '../../server/geometry.js';
import { armedPickup } from '../../server/rules/armedPickup.js';
import { prepareRemotePlacement } from '../../server/rules/gameplay/remotePlacementGeometry.js';
import { TANGIBLES } from '../../server/tangibles/tangibles.js';
import { actionButton } from '../ui/press.js';
import type { PhoneSession } from '../session.js';
import { PlacementMap } from './PlacementMap.js';

const errors: Record<PlacementFailure, string> = {
  disabled: 'Activez le mode accessibilité pour poser depuis le téléphone.',
  phase: 'La pose est disponible pendant la course.',
  busy: 'Une pose est déjà en cours sur la table.',
  'wrong-mode': 'La console Oz utilise la pose manuelle.',
  'not-armed': 'Ce bonus doit être armé avant la pose.',
  'outside-table': 'La pose dépasse les bords de la table.',
  'blocked-zone': 'La pose empiète sur un poste ou une commande de table.',
  'outside-track': 'Placez le centre du boost sur la chaussée.',
  'out-of-range': 'Cette cible est hors de portée du lance-pierre.',
  invalid: 'Les dimensions ou l’angle de la pose sont invalides.',
};

type Tool = 1 | 2 | 3 | 'boost' | 'slingshot';

export class AccessiblePlacement {
  readonly root = document.createElement('section');
  private readonly toggle = document.createElement('input');
  private readonly body = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly response = document.createElement('p');
  private readonly along = document.createElement('input');
  private readonly lateral = document.createElement('div');
  private readonly adjust = document.createElement('div');
  private readonly map = new PlacementMap(pos => this.pickPoint(pos));
  private readonly confirm = actionButton('Confirmer la pose', () => this.submit(), 'primary');
  private readonly cancel = actionButton('Annuler l’aperçu', () => this.reset());
  private readonly tools;
  private state: GameState | null = null;
  private selection: Tool | null = null;
  private point: Vec2 | null = null;
  private lateralOffset = 0;
  private angle = 0;
  private width = 140;
  private request: number | null = null;
  private enabled = false;
  private lastTrack = -1;

  constructor(private readonly session: PhoneSession, private readonly seat: SeatId) {
    this.root.className = 'accessible-placement';
    this.toggle.type = 'checkbox';
    this.toggle.setAttribute('role', 'switch');
    const option = document.createElement('label');
    option.className = 'accessibility-switch';
    option.append(this.toggle, 'Mode accessibilité');
    this.toggle.addEventListener('change', () => {
      this.session.send({ type: 'SetAccessibility', on: this.toggle.checked });
    });
    const definition = [...TANGIBLES, { id: 'boost', name: 'Boost' }, { id: 'slingshot', name: 'Lance-pierre' }] as const;
    this.tools = definition.map(({ id, name }) => ({
      id, button: actionButton(name, () => this.choose(id)),
    }));
    const options = document.createElement('div');
    options.className = 'placement-actions';
    options.append(...this.tools.map(tool => tool.button));
    this.along.type = 'range';
    this.along.min = '0';
    this.along.max = '100';
    this.along.value = '0';
    this.along.addEventListener('input', () => { this.lateralOffset = 0; this.pickAlong(); });
    const trackPosition = document.createElement('label');
    trackPosition.className = 'track-position';
    trackPosition.append('Position le long du circuit', this.along);
    this.lateral.className = 'placement-actions';
    this.lateral.append(
      actionButton('Décaler à gauche', () => this.shift(-15)),
      actionButton('Décaler à droite', () => this.shift(15)),
      actionButton('Zoom −', () => { this.map.changeZoom(-1); this.refresh(); }),
      actionButton('Zoom +', () => { this.map.changeZoom(1); this.refresh(); }),
    );
    this.adjust.className = 'placement-actions';
    this.status.setAttribute('role', 'status');
    this.response.setAttribute('role', 'status');
    this.body.append(options, this.map.canvas, trackPosition, this.lateral, this.adjust, this.status,
      this.confirm, this.cancel, this.response);
    this.root.append(option, this.body);
  }

  /** Suit la préférence de place, l'état du circuit et la réponse privée du serveur. */
  update(state: GameState, enabled: boolean): void {
    this.state = state;
    this.enabled = enabled;
    if (this.lastTrack !== state.trackVersion) {
      this.lastTrack = state.trackVersion;
      if (!this.point) this.point = state.track?.centerline[0] ?? null;
    }
    this.toggle.checked = state.seats[this.seat].accessible === true;
    this.toggle.disabled = !enabled;
    this.body.hidden = !this.toggle.checked;
    const result = this.session.lastPlacement;
    if (result && result.requestId === this.request) {
      this.request = null;
      if (result.ok) this.reset(false);
      this.response.textContent = result.ok ? '✓ Pose confirmée sur la table.' : `× ${errors[result.reason]}`;
    } else if (!this.session.online && this.request !== null) {
      this.request = null;
      this.response.textContent = 'Connexion interrompue. Vérifiez la table avant de réessayer.';
    }
    this.refresh();
  }

  /** Active l'outil et prépare les boutons d'orientation ou de largeur. */
  private choose(tool: Tool): void {
    this.selection = tool;
    this.response.textContent = '';
    this.adjust.replaceChildren();
    if (tool === 1) this.adjust.append(
      actionButton('Tourner −15°', () => this.rotate(-15)),
      actionButton('Tourner +15°', () => this.rotate(15)),
    );
    if (tool === 'boost') this.adjust.append(
      actionButton('Largeur −', () => this.resizeBoost(-20)),
      actionButton('Largeur +', () => this.resizeBoost(20)),
    );
    this.refresh();
  }

  /** Affiche l'aperçu et indique précisément les poses indisponibles. */
  private refresh(): void {
    const s = this.state;
    if (!s || this.body.hidden) return;
    const armed = armedPickup(s);
    for (const { id, button } of this.tools) {
      button.setAttribute('aria-pressed', String(this.selection === id));
      button.disabled = !this.enabled || this.request !== null
        || (typeof id === 'string' ? armed?.kind !== id : s.tangiblePlacementMode !== 'touch');
    }
    const target = this.getTarget();
    this.along.disabled = !target || !this.enabled;
    this.lateral.hidden = this.adjust.hidden = !target;
    this.cancel.hidden = !target;
    this.cancel.disabled = this.request !== null;
    this.confirm.hidden = !target;
    if (!target) {
      this.map.canvas.hidden = this.along.parentElement!.hidden = true;
      this.setStatus('Choisissez un objet ou un bonus armé.');
      return;
    }
    this.map.canvas.hidden = this.along.parentElement!.hidden = false;
    const prepared = prepareRemotePlacement(s, playerTeam(this.seat), target);
    this.confirm.disabled = !this.enabled || this.request !== null || 'reason' in prepared;
    this.map.draw(s, target, prepared, this.session.sync.now());
    const setting = target.kind === 'boost' ? ` Largeur ${target.width} px.`
      : target.kind === 'tangible' && target.id === 1 ? ` Angle ${target.angle}°.`
      : 'kind' in prepared && prepared.kind === 'slingshot' ? ` Puissance ${Math.round(prepared.power * 100)} %.` : '';
    this.setStatus(('reason' in prepared ? `× ${errors[prepared.reason]}` : '✓ Emplacement valide.') + setting);
  }

  /** Calcule la demande à partir de l'outil et de la position courants. */
  private getTarget(): PlacementTarget | null {
    const { selection, point } = this;
    if (selection === null || !point) return null;
    if (selection === 'boost') return { kind: 'boost', pos: point, width: this.width };
    if (selection === 'slingshot') return { kind: 'slingshot', pos: point };
    return { kind: 'tangible', id: selection, pos: point, angle: this.angle };
  }

  /** Confirme une pose valide sans accaparer la table pendant le choix. */
  private submit(): void {
    const target = this.getTarget();
    if (!target || this.confirm.disabled || this.request !== null) return;
    this.response.textContent = '';
    this.request = this.session.requestPlacement(target);
    this.refresh();
  }

  /** Traduit un toucher de carte en position et synchronise le curseur. */
  private pickPoint(pos: Vec2): void {
    const track = this.state?.track;
    if (!this.enabled || !this.selection || !track || this.request !== null) return;
    this.point = pos;
    const hit = nearestOnTrack(pos, track);
    this.along.value = String(Math.round(hit.index * 100 / (track.centerline.length - 1)));
    const tangent = trackTangent(track, hit.index);
    const center = track.centerline[hit.index];
    this.lateralOffset = (pos.x - center.x) * -tangent.y + (pos.y - center.y) * tangent.x;
    this.refresh();
  }

  /** Calcule une position sur la piste et applique le décalage transversal. */
  private pickAlong(): void {
    const track = this.state?.track;
    if (!track || !this.enabled || this.request !== null) return;
    const index = Math.round(Number(this.along.value) / 100 * (track.centerline.length - 1));
    const pos = track.centerline[index], tangent = trackTangent(track, index);
    this.point = { x: pos.x - tangent.y * this.lateralOffset, y: pos.y + tangent.x * this.lateralOffset };
    this.refresh();
  }

  /** Déplace l'aperçu à gauche ou à droite de la trajectoire. */
  private shift(delta: number): void { this.lateralOffset += delta; this.pickAlong(); }

  /** Ajuste la rotation du mur par pas de quinze degrés. */
  private rotate(delta: number): void { this.angle = (this.angle + delta + 180) % 180; this.refresh(); }

  /** Ajuste la largeur du boost dans ses limites physiques. */
  private resizeBoost(delta: number): void {
    this.width = Math.min(this.state!.params.boostLenMaxPx, Math.max(110, this.width + delta));
    this.refresh();
  }

  /** Efface l'outil sans consommer un objet. */
  private reset(clearResponse = true): void {
    this.selection = null;
    if (clearResponse) this.response.textContent = '';
    this.refresh();
  }

  /** Évite de réannoncer une validation à chaque état réseau. */
  private setStatus(label: string): void { if (this.status.textContent !== label) this.status.textContent = label; }
}
