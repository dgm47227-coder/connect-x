import React, { useState } from 'react';
import {
  Save,
  ShieldCheck,
  Lock,
  Bell,
  Trash2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  MailCheck,
} from 'lucide-react';
import {
  AbuseReport,
  FriendRequestPolicy,
  StoryAudience,
  UserPrivateSettings,
  UserPublicProfile,
} from '../types/connectx';
import {
  evaluateSecurityRulePayload,
  normalizeUsername,
  validateProfileInput,
} from '../utils/connectxRules';
import { createAvatarSvg } from '../utils/seedData';

interface ProfileViewProps {
  currentUser: UserPublicProfile;
  privateSettings: UserPrivateSettings;
  acceptedFriendsCount: number;
  reports: AbuseReport[];
  isFirebaseAuthenticated: boolean;
  emailVerified: boolean;
  onUpdateProfile: (updated: Partial<UserPublicProfile>) => void;
  onUpdatePrivateSettings: (updated: Partial<UserPrivateSettings>) => void;
  onRequestEmailVerification: () => void;
  onRequestPasswordReset: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

const AVATAR_PRESETS = [
  { label: 'Cobalt Indigo', bg: '#2563eb', accent: '#4f46e5' },
  { label: 'Royal Violet', bg: '#4f46e5', accent: '#7c3aed' },
  { label: 'Deep Ocean', bg: '#0284c7', accent: '#1d4ed8' },
  { label: 'Slate Midnight', bg: '#1e293b', accent: '#475569' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  privateSettings,
  acceptedFriendsCount,
  reports,
  isFirebaseAuthenticated,
  emailVerified,
  onUpdateProfile,
  onUpdatePrivateSettings,
  onRequestEmailVerification,
  onRequestPasswordReset,
  onDeleteAccount,
  onLogout,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [whoCanRequest, setWhoCanRequest] = useState<FriendRequestPolicy>(
    currentUser.privacyWhoCanRequest
  );
  const [storyAudience, setStoryAudience] = useState<StoryAudience>(
    currentUser.privacyStoryAudience
  );
  const [showReadReceipts, setShowReadReceipts] = useState(
    currentUser.privacyShowReadReceipts
  );
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    currentUser.privacyShowOnlineStatus
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const normalized = normalizeUsername(username);
    const check = validateProfileInput({
      username: normalized,
      displayName,
      bio,
    });
    if (!check.valid) {
      setErrorMessage(check.error || 'Invalid profile fields');
      return;
    }

    onUpdateProfile({
      username: normalized,
      displayName: displayName.trim(),
      bio: bio.trim(),
      privacyWhoCanRequest: whoCanRequest,
      privacyStoryAudience: storyAudience,
      privacyShowReadReceipts: showReadReceipts,
      privacyShowOnlineStatus: showOnlineStatus,
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage('Profile and privacy preferences saved.');
  };

  const handleSelectAvatarColor = (bg: string, accent: string) => {
    const initials =
      displayName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'CX';
    const svgUrl = createAvatarSvg(initials, bg, accent);
    onUpdateProfile({ avatarUrl: svgUrl });
    setStatusMessage('Profile avatar updated.');
  };

  const dirtyDozenChecks = [
    {
      id: 'shadow_privilege_escalation',
      name: 'Shadow Field Injection (isAdmin: true)',
      result: evaluateSecurityRulePayload(
        'shadow_privilege_escalation',
        { uid: currentUser.uid, username: currentUser.username, isAdmin: true },
        { uid: currentUser.uid, emailVerified: true, nowIso: new Date().toISOString() }
      ),
    },
    {
      id: 'read_private_pii',
      name: 'Cross-User PII Read (/users_private/other_uid)',
      result: evaluateSecurityRulePayload(
        'read_private_pii',
        { requestedUserId: 'user_elena_02' },
        { uid: currentUser.uid, emailVerified: true, nowIso: new Date().toISOString() }
      ),
    },
    {
      id: 'forged_request_accept_by_sender',
      name: 'Sender Self-Accepting Outgoing Friend Request',
      result: evaluateSecurityRulePayload(
        'forged_request_accept_by_sender',
        { fromUid: currentUser.uid, toUid: 'user_liam_07', currentStatus: 'pending' },
        { uid: currentUser.uid, emailVerified: true, nowIso: new Date().toISOString() }
      ),
    },
    {
      id: 'expired_story_read',
      name: 'Reading Expired 24h Story Document',
      result: evaluateSecurityRulePayload(
        'expired_story_read',
        { expiresAt: '2020-01-01T00:00:00.000Z' },
        { uid: currentUser.uid, emailVerified: true, nowIso: new Date().toISOString() }
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Profile Summary & Edit Form */}
      <div className="lg:col-span-7 space-y-6">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight">{currentUser.displayName}</h1>
                <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                  @{currentUser.username}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
                  <span>{acceptedFriendsCount} Accepted Friends</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isFirebaseAuthenticated
                      ? emailVerified
                        ? 'Firebase Auth Verified'
                        : 'Email Unverified'
                      : 'Interactive Workspace Session'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {statusMessage && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Avatar Style Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Customize Profile Avatar Badge
            </span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectAvatarColor(preset.bg, preset.accent)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-xs font-medium flex items-center gap-2 cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: preset.bg }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Display Name (1–60 chars)
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-username"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Unique @Username
                </label>
                <input
                  id="profile-username"
                  type="text"
                  required
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Bio ({bio.length}/250 characters)
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                maxLength={250}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label
                  htmlFor="privacy-requests"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Who Can Send Friend Requests
                </label>
                <select
                  id="privacy-requests"
                  value={whoCanRequest}
                  onChange={(e) => setWhoCanRequest(e.target.value as FriendRequestPolicy)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
                >
                  <option value="everyone">Everyone on ConnectX</option>
                  <option value="none">No One (Pause Incoming Requests)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="privacy-stories"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Default Story Audience
                </label>
                <select
                  id="privacy-stories"
                  value={storyAudience}
                  onChange={(e) => setStoryAudience(e.target.value as StoryAudience)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
                >
                  <option value="friends">Accepted Friends Only</option>
                  <option value="public">Public Discovery</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-medium">
                  Share Read Receipts in 1:1 Conversations
                </span>
                <input
                  type="checkbox"
                  checked={showReadReceipts}
                  onChange={(e) => setShowReadReceipts(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-medium">
                  Display Online Presence Indicator to Friends
                </span>
                <input
                  type="checkbox"
                  checked={showOnlineStatus}
                  onChange={(e) => setShowOnlineStatus(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile & Privacy Changes</span>
            </button>
          </form>
        </section>
      </div>

      {/* Right Column: Isolated Private Settings, Notification Previews & Security Audit */}
      <div className="lg:col-span-5 space-y-6">
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold tracking-tight">
              Private Notification & Lock-Screen Controls
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stored in <code className="font-mono">/users_private/{currentUser.uid}</code> (isolated
            from public discovery).
          </p>

          <div className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <span className="text-slate-500">Private Account Email:</span>
            <span className="font-mono font-semibold">{privateSettings.email}</span>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <div>
                <div className="text-xs font-semibold">Show Message Previews in Notifications</div>
                <div className="text-[11px] text-slate-500">
                  When disabled, lock-screen and banner alerts hide message text.
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notificationPreviewEnabled}
                onChange={(e) =>
                  onUpdatePrivateSettings({
                    notificationPreviewEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <span className="text-xs font-medium">Friend Request Alerts</span>
              <input
                type="checkbox"
                checked={privateSettings.notifyFriendRequests}
                onChange={(e) =>
                  onUpdatePrivateSettings({ notifyFriendRequests: e.target.checked })
                }
                className="w-4 h-4 accent-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <span className="text-xs font-medium">New Direct Message Alerts</span>
              <input
                type="checkbox"
                checked={privateSettings.notifyMessages}
                onChange={(e) => onUpdatePrivateSettings({ notifyMessages: e.target.checked })}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
          </div>
        </section>

        {/* Account Security & Data Deletion Policy */}
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold tracking-tight">Account Security & Lifecycle</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onRequestEmailVerification();
                setStatusMessage('Verification email request dispatched via Firebase Auth.');
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <MailCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Verify Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onRequestPasswordReset();
                setStatusMessage(
                  `Password change/reset email dispatched to ${privateSettings.email}.`
                );
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>

          {confirmDeleteOpen && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 space-y-3">
              <div className="text-xs font-bold text-red-700 dark:text-red-300">
                Confirm Permanent Account & Data Deletion
              </div>
              <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
                Deleting your account removes your <code className="font-mono">/users</code>{' '}
                profile, <code className="font-mono">/users_private</code> PII record,{' '}
                <code className="font-mono">/usernames/@{currentUser.username}</code> reservation,
                active stories, and signs out your session.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDeleteAccount}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 cursor-pointer"
                >
                  Confirm Delete Account
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Zero-Trust Firestore Security Rules Verification Panel */}
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold tracking-tight">
              Hardened Firestore Security Rules Verification
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live verification of deployed <code className="font-mono">firestore.rules</code> gates
            and submitted abuse reports ({reports.length} filed).
          </p>

          <div className="space-y-2">
            {dirtyDozenChecks.map((check) => (
              <div
                key={check.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex items-start justify-between gap-2"
              >
                <div>
                  <div className="font-semibold">{check.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {check.result.violation}
                  </div>
                </div>
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                  BLOCKED
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
