/**
 * Which way you are facing, from whichever sensor can answer.
 *
 * Two sources, neither of which is sufficient alone. The device compass reports
 * while you stand still, which is the case you are usually looking at the map
 * in, but it needs a gesture-gated grant on iOS and does not exist on a
 * desktop. GPS course (`coords.heading`) needs no permission and is there on
 * every fix, but it is null unless you are actually moving. So: compass when
 * there is one, GPS course when there is not, nothing when neither can say.
 *
 * No Leaflet in here — this module answers "which way", and map.ts decides what
 * to draw with the answer.
 */

export type Heading = { degrees: number; source: 'compass' | 'gps' };

/** Safari's non-standard compass field, absent from lib.dom.d.ts. Declared as
 *  an intersection rather than a global augmentation so the rest of the project
 *  never sees a property that only exists on one engine. */
type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** iOS 13+ only. Everywhere else the constructor has no such method — including
 *  desktops, which simply never fire a usable event and so need no button. */
type PermissionCapable = { requestPermission: () => Promise<PermissionState> };

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** The browser rotates the orientation frame along with the page, so a phone
 *  held sideways reports a heading turned by the same amount. Undo it. */
const screenAngle = () => screen.orientation?.angle ?? 0;

function bearingOf(e: CompassEvent): number | null {
  // iOS never sets absolute:true and its alpha is in an arbitrary frame, but it
  // ships webkitCompassHeading, which is already a clockwise-from-north bearing.
  const webkit = e.webkitCompassHeading;
  if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
    return norm(webkit + screenAngle());
  }
  // alpha runs counter-clockwise from north; a compass bearing runs clockwise.
  // A non-absolute alpha is relative to wherever the device happened to be when
  // it started, which is worse than no arrow at all.
  if (e.absolute !== true || e.alpha == null || Number.isNaN(e.alpha)) return null;
  return norm(360 - e.alpha + screenAngle());
}

function permissionApi(): PermissionCapable | null {
  const ctor = window.DeviceOrientationEvent as unknown as Partial<PermissionCapable> | undefined;
  return typeof ctor?.requestPermission === 'function' ? (ctor as PermissionCapable) : null;
}

/** True where the compass is gated behind an explicit gesture-driven grant. */
export function compassNeedsPermission(): boolean {
  return permissionApi() !== null;
}

/**
 * Ask for the compass. Must be called from a user gesture — that is the whole
 * reason there is a button for it. Resolves false on denial or on any platform
 * with nothing to ask.
 */
export async function requestCompassPermission(): Promise<boolean> {
  const api = permissionApi();
  if (!api) return false;
  try {
    const granted = (await api.requestPermission()) === 'granted';
    // A running startHeading() attached listeners that iOS was silently
    // dropping events for; re-attaching is what makes them start arriving,
    // without the caller having to tear the watch down and rebuild it.
    if (granted) for (const attach of attachers) attach();
    return granted;
  } catch {
    return false;
  }
}

/** Live startHeading() instances, so a late grant can wake them all. */
const attachers = new Set<() => void>();

export type HeadingHandle = {
  /** Fed from the geolocation watch. Only consulted when no compass is live. */
  pushFix: (heading: number | null, speed: number | null) => void;
  stop: () => void;
};

/** How long after the last compass event we still consider the compass live.
 *  deviceorientation fires at tens of hertz, so any real compass stays well
 *  inside this and GPS course never gets a look in while one exists. */
const COMPASS_TIMEOUT = 5000;

/** Below roughly a slow walk, GPS course is noise: the fix wanders a few metres
 *  between samples and the reported bearing spins with it. */
const MIN_SPEED = 0.6; // m/s

/** Smaller than this and nobody can see the difference, so don't touch the DOM. */
const MIN_CHANGE = 1; // degrees

export function startHeading(onHeading: (heading: Heading | null) => void): HeadingHandle {
  let lastCompass = -Infinity;
  let pending: Heading | null = null;
  let sent: Heading | null = null;
  let frame = 0;
  let stopped = false;

  const compassLive = () => performance.now() - lastCompass < COMPASS_TIMEOUT;

  // deviceorientation arrives far faster than the map can use. Fold everything
  // into one pending value and flush once per frame; a phone lying on a table
  // then costs nothing rather than sixty style writes a second.
  function queue(next: Heading | null) {
    pending = next;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (stopped) return;
      const value = pending;
      const same =
        value === null
          ? sent === null
          : sent !== null &&
            sent.source === value.source &&
            Math.abs(((value.degrees - sent.degrees + 540) % 360) - 180) < MIN_CHANGE;
      if (same) return;
      sent = value;
      onHeading(value);
    });
  }

  function onOrientation(e: Event) {
    const bearing = bearingOf(e as CompassEvent);
    if (bearing === null) return;
    lastCompass = performance.now();
    queue({ degrees: bearing, source: 'compass' });
  }

  // Both events, because Chrome fires only `deviceorientationabsolute` with a
  // true-north frame while Safari fires only `deviceorientation` and carries
  // its bearing in webkitCompassHeading. bearingOf() rejects whatever arrives
  // without an absolute frame, so listening to both cannot introduce a
  // device-relative reading.
  const attach = () => {
    if (stopped) return;
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
  };

  // Listeners go on immediately even where a grant is still pending: on iOS
  // they simply receive nothing until requestCompassPermission() succeeds, and
  // everywhere else there is no grant to wait for.
  attach();
  attachers.add(attach);

  return {
    pushFix(heading, speed) {
      // The latch, not a per-sample comparison: a live compass wins outright,
      // so the two sources can never trade the arrow back and forth.
      if (compassLive()) return;
      const usable =
        heading != null &&
        !Number.isNaN(heading) &&
        (speed == null || speed >= MIN_SPEED);
      queue(usable ? { degrees: norm(heading), source: 'gps' } : null);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      attachers.delete(attach);
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
    },
  };
}
