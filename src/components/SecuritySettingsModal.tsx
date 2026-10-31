import React, { useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Globe,
  Trash2,
  KeyRound,
  AlertTriangle,
  X,
  LogOut,
  CheckCircle2,
  Lock,
  Copy,
  Info,
  Laptop,
} from 'lucide-react';
import { DeviceTokenRecord } from '../types/connectx';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  currentUserId: string;
  devices: DeviceTokenRecord[];
  safetyNumber?: string;
  onRevokeDevice: (tokenId: string) => Promise<void>;
  onSignOutAllOtherDevices: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onClose: () => void;
}

type SecurityTab = 'devices' | 'e2ee' | 'danger';

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  currentUserId,
  devices,
  safetyNumber = 'CX-9481-5520-7714-3891-6204',
  onRevokeDevice,
  onSignOutAllOtherDevices,
  onDeleteAccount,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SecurityTab>('devices');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentDeviceId =
    typeof window !== 'undefined'
      ? localStorage.getItem('connectx_device_id')
      : null;

  const handleCopySafetyNumber = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(safetyNumber).catch(() => {});
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setActionLoading(true);
    try {
      await onRevokeDevice(tokenId);
      setStatusMessage('Device access revoked successfully.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Failed to revoke device session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignOutAllOthers = async () => {
    setActionLoading(true);
    try {
      await onSignOutAllOtherDevices();
      setStatusMessage('Signed out from all other active sessions.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Failed to sign out other sessions.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirmDeleteText !== 'DELETE') return;
    setActionLoading(true);
    try {
      await onDeleteAccount();
      onClose();
    } catch {
      setStatusMessage('Error processing account deletion.');
      setActionLoading(false);
    }
  };

  const getDeviceIcon = (platform: string, model?: string) => {
    if (platform === 'android' || (model && model.toLowerCase().includes('android'))) {
      return <Smartphone className="w-5 h-5 text-emerald-600" />;
    }
    if (platform === 'ios') {
      return <Smartphone className="w-5 h-5 text-blue-600" />;
    }
    return <Laptop className="w-5 h-5 text-slate-700" />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#008C5A]/15 text-[#006B46]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="security-modal-title" className="text-base font-bold text-slate-900">
                Account Security & Encryption
              </h3>
              <p className="text-[11px] text-slate-500">
                Manage authorized devices, E2EE identity, and account recovery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close security settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'devices'
                ? 'bg-[#008C5A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active Devices ({devices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('e2ee')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'e2ee'
                ? 'bg-[#008C5A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            E2EE Identity & Keys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('danger')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'danger'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Danger Zone
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: Devices */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Registered Devices</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    These devices have authorized notification tokens and session keys for your account.
                  </p>
                </div>
                {devices.length > 1 && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleSignOutAllOthers}
                    className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out Others</span>
                  </button>
                )}
              </div>

              {devices.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                  No active devices recorded. Current session is running in this client.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {devices.map((dev) => {
                    const isThisDevice =
                      Boolean(currentDeviceId) && dev.tokenId.includes(currentDeviceId || '');

                    return (
                      <div
                        key={dev.tokenId}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isThisDevice
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
                            {getDeviceIcon(dev.platform, dev.deviceModel)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">
                                {dev.deviceModel || `${dev.platform.toUpperCase()} Client`}
                              </span>
                              {isThisDevice && (
                                <span className="px-2 py-0.5 rounded-full bg-[#008C5A] text-white text-[10px] font-bold">
                                  This Device
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-xs font-mono">
                              {dev.userAgent ? dev.userAgent.slice(0, 60) + '...' : 'ConnectX Native'}
                            </p>
                          </div>
                        </div>

                        {!isThisDevice && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleRevoke(dev.tokenId)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-colors shrink-0"
                            title="Revoke session and push tokens"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: E2EE Identity */}
          {activeTab === 'e2ee' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  <span>End-to-End Cryptography Standard</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  ConnectX uses audited W3C Web Cryptography API primitives (ECDH Curve P-256 with
                  AES-256-GCM authenticated cipher). Your private encryption key is stored securely
                  in this browser&apos;s IndexedDB and is non-extractable.
                </p>
              </div>

              {/* Safety Number */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Your Cryptographic Safety Number</span>
                  <button
                    type="button"
                    onClick={handleCopySafetyNumber}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#008C5A] hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 font-mono text-center text-xs tracking-wider text-slate-800 border border-slate-200 select-all font-bold">
                  {safetyNumber}
                </div>
                <p className="text-[11px] text-slate-500">
                  Compare this fingerprint with your conversation partner to verify that your session is
                  not subject to a man-in-the-middle interception.
                </p>
              </div>

              {/* Recovery Limitation Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">E2EE Key Recovery Notice</div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Because ConnectX never receives your private key, password resets cannot recover
                    previously encrypted messages if your device is wiped. We will never silently reset
                    your cryptographic identity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Danger Zone */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Permanent Account Deletion</span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Deleting your account will immediately purge your user profile, friends, chat logs,
                  notifications, device tokens, and cryptographic keys from Cloud Firestore. This action
                  is irreversible.
                </p>

                <div className="pt-2">
                  <label htmlFor="confirm-delete" className="block text-xs font-bold text-slate-700 mb-1">
                    Type <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-700">DELETE</code> to confirm:
                  </label>
                  <input
                    id="confirm-delete"
                    type="text"
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>

                <button
                  type="button"
                  disabled={confirmDeleteText !== 'DELETE' || actionLoading}
                  onClick={handleDelete}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{actionLoading ? 'Purging account...' : 'Permanently Delete Account'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
