import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DeviceTokenRecord, UserNotificationType } from '../types/connectx';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PlatformInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isIOSPWA: boolean;
  isDesktop: boolean;
  isCapacitor: boolean;
  supportsPush: boolean;
}

/**
 * Detect current platform and notification capabilities
 */
export function getPlatformInfo(): PlatformInfo {
  if (typeof window === 'undefined') {
    return {
      isAndroid: false,
      isIOS: false,
      isIOSPWA: false,
      isDesktop: true,
      isCapacitor: false,
      supportsPush: false,
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  const isAndroid = isCapacitor || /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isIOSPWA =
    isIOS &&
    (Boolean((window.navigator as unknown as { standalone?: boolean }).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches);
  const isDesktop = !isAndroid && !isIOS;
  const supportsPush =
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  return {
    isAndroid,
    isIOS,
    isIOSPWA,
    isDesktop,
    isCapacitor,
    supportsPush,
  };
}

/**
 * Check current system-level notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Request notification permission from the browser / device
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch (error) {
    console.warn('Notification permission request returned error:', error);
    return Notification.permission as NotificationPermissionState;
  }
}

/**
 * Generate a consistent, unique device identifier for multi-device token tracking
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  let id = localStorage.getItem('connectx_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('connectx_device_id', id);
  }
  return id;
}

/**
 * Register or update device token in Cloud Firestore
 */
export async function registerDeviceToken(
  uid: string,
  token?: string
): Promise<void> {
  if (!uid) return;

  const platformInfo = getPlatformInfo();
  const deviceId = getDeviceId();
  const tokenId = `${uid}_${deviceId}`;
  const effectiveToken = token || `web_token_${deviceId}`;

  const platform: 'android' | 'ios' | 'web' = platformInfo.isAndroid
    ? 'android'
    : platformInfo.isIOS
    ? 'ios'
    : 'web';

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 480) : '';

  try {
    const tokenRecord: DeviceTokenRecord = {
      tokenId,
      uid,
      token: effectiveToken,
      platform,
      deviceModel: platformInfo.isCapacitor ? 'Android Native' : platformInfo.isIOSPWA ? 'iOS PWA' : 'Web Client',
      userAgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'device_tokens', tokenId), {
      ...tokenRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    localStorage.setItem('connectx_registered_token_id', tokenId);
  } catch (err) {
    console.warn('Failed to register device token in Firestore:', err);
  }
}

/**
 * Unregister device token from Cloud Firestore on sign-out
 */
export async function unregisterDeviceToken(uid: string): Promise<void> {
  if (!uid) return;
  const deviceId = getDeviceId();
  const tokenId = `${uid}_${deviceId}`;

  try {
    await deleteDoc(doc(db, 'device_tokens', tokenId));
    localStorage.removeItem('connectx_registered_token_id');
  } catch (err) {
    console.warn('Failed to unregister device token on sign out:', err);
  }
}

/**
 * Synthesize a soft notification chime using Web Audio API
 */
export function playNotificationChime(isCall: boolean = false): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (isCall) {
      // Pleasant double-tone call chime: 587Hz (D5) -> 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(587.33, now);
      osc2.frequency.setValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);

      setTimeout(() => ctx.close().catch(() => {}), 600);
    } else {
      // Soft message bubble chime: 659Hz (E5) -> 987Hz (B5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.15);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);

      setTimeout(() => ctx.close().catch(() => {}), 400);
    }
  } catch {
    // Audio synthesis handled
  }
}

/**
 * Trigger mobile haptic vibration if supported and permitted
 */
export function vibrateDevice(pattern: number[] = [100, 50, 100]): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration handled
    }
  }
}

/**
 * Display native operating system / browser notification when appropriate
 */
export function showNativeNotification(
  title: string,
  options?: NotificationOptions & { targetId?: string; type?: UserNotificationType }
): Notification | null {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return null;
  }

  try {
    const notif = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      ...options,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      if (options?.targetId) {
        window.dispatchEvent(
          new CustomEvent('connectx:navigate', {
            detail: {
              targetId: options.targetId,
              type: options.type || 'new_message',
            },
          })
        );
      }
    };

    return notif;
  } catch (err) {
    console.warn('Native notification display error:', err);
    return null;
  }
}

// In-memory deduplication cache for notifications
const processedNotificationIds = new Set<string>();

export function isNotificationDuplicate(id: string): boolean {
  if (processedNotificationIds.has(id)) {
    return true;
  }
  processedNotificationIds.add(id);
  // Keep cache size bounded
  if (processedNotificationIds.size > 200) {
    const firstKey = processedNotificationIds.values().next().value;
    if (firstKey) processedNotificationIds.delete(firstKey);
  }
  return false;
}
