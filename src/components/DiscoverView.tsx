import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  UserCheck,
  Clock,
  Eye,
  Ban,
  Flag,
  MessageSquare,
  X,
  Shield,
} from 'lucide-react';
import {
  FriendRequest,
  Friendship,
  UserBlock,
  UserPublicProfile,
} from '../types/connectx';

interface DiscoverViewProps {
  currentUser: UserPublicProfile;
  directoryUsers: UserPublicProfile[];
  friendships: Friendship[];
  friendRequests: FriendRequest[];
  blocks: UserBlock[];
  onSendFriendRequest: (targetUser: UserPublicProfile) => void;
  onCancelFriendRequest: (request: FriendRequest) => void;
  onAcceptFriendRequest: (request: FriendRequest) => void;
  onStartChat: (
    uid: string,
    displayName: string,
    username: string,
    avatarUrl: string
  ) => void;
  onBlockUser: (targetUser: UserPublicProfile, reason: string) => void;
  onReportTarget: (
    targetUid: string,
    targetLabel: string,
    targetType: 'user' | 'message' | 'story'
  ) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  currentUser,
  directoryUsers,
  friendships,
  friendRequests,
  blocks,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onStartChat,
  onBlockUser,
  onReportTarget,
}) => {
  const [query, setQuery] = useState('');
  const [previewUser, setPreviewUser] = useState<UserPublicProfile | null>(null);

  const blockedUids = new Set(blocks.map((b) => b.blockedUid));

  const friendUids = new Set(
    friendships.map((f) => (f.user1Uid === currentUser.uid ? f.user2Uid : f.user1Uid))
  );

  const discoverableUsers = directoryUsers.filter(
    (u) => u.uid !== currentUser.uid && u.isPublicProfile && !blockedUids.has(u.uid)
  );

  const normalizedQuery = query.trim().replace(/^@+/, '').toLowerCase();

  const searchResults = normalizedQuery
    ? discoverableUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(normalizedQuery) ||
          u.displayName.toLowerCase().includes(normalizedQuery)
      )
    : discoverableUsers;

  // Transparent Suggested Users logic: non-friends who share mutual connections
  const suggestedUsers = discoverableUsers.filter(
    (u) => !friendUids.has(u.uid) && (u.mutualFriendsCount || 0) > 0
  );

  const getRelationshipState = (targetUid: string) => {
    if (friendUids.has(targetUid)) {
      return { status: 'friends' as const };
    }
    const outgoing = friendRequests.find(
      (r) =>
        r.fromUid === currentUser.uid &&
        r.toUid === targetUid &&
        r.status === 'pending'
    );
    if (outgoing) {
      return { status: 'outgoing' as const, request: outgoing };
    }
    const incoming = friendRequests.find(
      (r) =>
        r.fromUid === targetUid &&
        r.toUid === currentUser.uid &&
        r.status === 'pending'
    );
    if (incoming) {
      return { status: 'incoming' as const, request: incoming };
    }
    return { status: 'none' as const };
  };

  return (
    <div className="space-y-6">
      {/* Search Bar Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Discover People</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Search by unique <span className="font-mono">@username</span>. Email addresses, phone
              numbers, and private settings are never exposed in public discovery.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <Shield className="w-4 h-4 shrink-0" />
            <span>PII-Free Public Index</span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search users by username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by @username (e.g. marcus_chen, nadia_lin, elena_rostova)..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Suggested Connections (Transparent Selection Logic) */}
      {!normalizedQuery && suggestedUsers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold tracking-tight">
              Suggested Connections (Based on Mutual Friends)
            </h2>
            <span className="text-xs text-slate-500">
              Ranked by verified mutual friendships
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestedUsers.map((user) => {
              const rel = getRelationshipState(user.uid);
              return (
                <div
                  key={user.uid}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewUser(user)}
                        className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">{user.displayName}</h3>
                      <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                        @{user.username}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2">
                        {user.bio}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {user.suggestionReason || `${user.mutualFriendsCount} mutual friends`}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    {rel.status === 'none' && (
                      <button
                        type="button"
                        disabled={user.privacyWhoCanRequest === 'none'}
                        onClick={() => onSendFriendRequest(user)}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          {user.privacyWhoCanRequest === 'none'
                            ? 'Requests Disabled'
                            : 'Add Friend'}
                        </span>
                      </button>
                    )}
                    {rel.status === 'outgoing' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onCancelFriendRequest(rel.request!)}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending (Cancel)</span>
                      </button>
                    )}
                    {rel.status === 'incoming' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onAcceptFriendRequest(rel.request!)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Accept Request</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Directory / Search Results */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight">
            {normalizedQuery
              ? `Search Results for "${normalizedQuery}" (${searchResults.length})`
              : `Public Directory (${searchResults.length})`}
          </h2>
          <span className="text-xs text-slate-500">Click any card to inspect full profile</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2">
              <p className="text-sm font-semibold">No matching @username found</p>
              <p className="text-xs text-slate-500">
                Try searching for another handle such as @elena_rostova or @nadia_lin.
              </p>
            </div>
          ) : (
            searchResults.map((user) => {
              const rel = getRelationshipState(user.uid);
              return (
                <div
                  key={user.uid}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold truncate">{user.displayName}</h3>
                        <span className="text-xs text-slate-400 tabular-nums">
                          · {user.friendsCount} friends
                        </span>
                      </div>
                      <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                        @{user.username}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                        {user.bio}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewUser(user)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View Profile
                    </button>

                    {rel.status === 'friends' && (
                      <button
                        type="button"
                        onClick={() =>
                          onStartChat(user.uid, user.displayName, user.username, user.avatarUrl)
                        }
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-600/20 flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    )}

                    {rel.status === 'none' && (
                      <button
                        type="button"
                        onClick={() => onSendFriendRequest(user)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend</span>
                      </button>
                    )}

                    {rel.status === 'outgoing' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onCancelFriendRequest(rel.request!)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    )}

                    {rel.status === 'incoming' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onAcceptFriendRequest(rel.request!)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                      >
                        Accept Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Profile Preview Modal */}
      {previewUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-preview-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={previewUser.avatarUrl}
                  alt={previewUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <h3 id="profile-preview-title" className="text-base font-bold">
                    {previewUser.displayName}
                  </h3>
                  <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                    @{previewUser.username}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 tabular-nums">
                    <span>{previewUser.friendsCount} Friends</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {previewUser.privacyShowOnlineStatus && previewUser.isOnline
                        ? 'Online'
                        : 'Status Private'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close profile preview"
                onClick={() => setPreviewUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {previewUser.bio || 'No bio provided.'}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 space-y-1">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Privacy Policy:
                </span>{' '}
                Email address and phone number are hidden by ConnectX PII Isolation.
              </div>
              {previewUser.suggestionReason && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Connection Context:
                  </span>{' '}
                  {previewUser.suggestionReason}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onBlockUser(previewUser, 'Blocked from profile preview');
                    setPreviewUser(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = previewUser;
                    setPreviewUser(null);
                    onReportTarget(u.uid, `@${u.username}`, 'user');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
