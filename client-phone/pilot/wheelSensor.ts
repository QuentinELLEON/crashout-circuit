/**
 * Écoute le capteur autorisé, surveille ses interruptions et calibre le volant.
 * Liens : client-phone/pilot/gyro.ts, client-phone/pilot/PilotScreen.ts.
 */
import { WHEEL, wheelAngle, neutralAngle, steerFromAngle, smoothSteer, throttleFromPitch } from './gyro.js';
import type { DriveSample } from './gyro.js';

type Reading = NonNullable<ReturnType<typeof wheelAngle>>;
export type WheelStatus = 'touch' | 'waiting' | 'calibrating' | 'ready' | 'missing' | 'denied' | 'http';
type OrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class WheelSensor {
  status: WheelStatus = 'touch';
  private started = 0;
  private lastReading = 0;
  private calibration: Reading[] = [];
  private calibrationStart = 0;
  private neutral: Reading | null = null;
  private steer = 0;
  private throttle = 0;
  private stopped = false;

  /** Demande l'autorisation au toucher et commence l'écoute après acceptation. */
  async activate(): Promise<void> {
    if (!window.isSecureContext) { this.status = 'http'; return; }
    if (typeof DeviceOrientationEvent === 'undefined') { this.status = 'missing'; return; }
    const event = DeviceOrientationEvent as OrientationWithPermission;
    try {
      if (event.requestPermission && await event.requestPermission() !== 'granted') {
        this.status = 'denied';
        return;
      }
    } catch {
      this.status = 'denied';
      return;
    }
    if (this.stopped) return;
    window.addEventListener('deviceorientation', this.onOrientation);
    window.addEventListener('orientationchange', this.calibrate);
    screen.orientation?.addEventListener('change', this.calibrate);
    this.calibrate();
  }

  /** Recalibre sur les prochaines mesures et neutralise la commande en attendant. */
  calibrate = (): void => {
    this.started = performance.now();
    this.lastReading = 0;
    this.calibration = [];
    this.calibrationStart = 0;
    this.neutral = null;
    this.steer = this.throttle = 0;
    this.status = 'waiting';
  };

  /** Détache les capteurs quand le joueur quitte l'écran de pilotage. */
  close(): void {
    this.stopped = true;
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('orientationchange', this.calibrate);
    screen.orientation?.removeEventListener('change', this.calibrate);
  }

  /** Renvoie le braquage et la pédale disponibles à cet instant. */
  read(now: number): DriveSample {
    if (['waiting', 'calibrating', 'ready'].includes(this.status)
      && now - (this.lastReading || this.started) > WHEEL.timeoutMs) {
      this.status = 'missing';
      this.steer = this.throttle = 0;
    }
    return this.status === 'ready' ? { steer: this.steer, throttle: this.throttle } : { steer: 0, throttle: 0 };
  }

  /** Agrège les mesures de calibration, puis alimente le volant et la pédale. */
  private onOrientation = (event: DeviceOrientationEvent): void => {
    if (document.hidden || this.status === 'missing') return;
    const now = performance.now();
    const reading = wheelAngle(event.beta, event.gamma, screen.orientation?.angle ?? window.orientation ?? 0);
    if (!reading) return;
    this.lastReading = now;
    if (!this.neutral) {
      if (!this.calibration.length) this.calibrationStart = now;
      this.status = 'calibrating';
      this.calibration.push(reading);
      if (now - this.calibrationStart < WHEEL.calibrationMs) return;
      this.neutral = neutralAngle(this.calibration);
      this.calibration = [];
      this.status = 'ready';
    }
    this.steer = smoothSteer(this.steer, steerFromAngle(reading.wheel, this.neutral.wheel));
    this.throttle = throttleFromPitch(reading.pitch, this.neutral.pitch);
  };
}
