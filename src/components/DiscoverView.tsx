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
  Database,
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
    <div className="space-y-6 text-black">
      {/* Search Bar Card */}
      <div className="p-6 rounded-2xl border border-slate-300 bg-white space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-black">
              Discover Real ConnectX Users
            </h1>
            <p className="text-xs text-black mt-0.5">
              Synced live with Cloud Firestore (
              <code className="font-mono font-bold">/users</code>). All bot/AI accounts are removed
              — only real registered users appear here.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-black font-bold">
            <Database className="w-4 h-4 text-black shrink-0" />
            <span>Live Firebase Directory ({discoverableUsers.length} other users)</span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search users by username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search real users by @username or display name..."
            className="w-full pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
          />
        </div>
      </div>

      {/* Directory / Search Results */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight text-black">
            {normalizedQuery
              ? `Search Results for "${normalizedQuery}" (${searchResults.length})`
              : `Registered Users in Cloud Firestore (${searchResults.length})`}
          </h2>
          <span className="text-xs text-black">
            Your handle: <strong className="font-mono text-black">@{currentUser.username}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-300 bg-white text-center space-y-3 text-black">
              <p className="text-sm font-bold text-black">
                {normalizedQuery
                  ? `No user found matching "@${normalizedQuery}"`
                  : 'No other users have joined your Firebase database yet'}
              </p>
              <p className="text-xs text-black max-w-md mx-auto leading-relaxed">
                All fake bot accounts have been deleted. As soon as your friends sign in to
                ConnectX, their profile will appear here automatically in real time!
              </p>
            </div>
          ) : (
            searchResults.map((user) => {
              const rel = getRelationshipState(user.uid);
              return (
                <div
                  key={user.uid}
                  className="p-5 rounded-2xl border border-slate-300 bg-white flex items-start justify-between gap-4 text-black"
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
                        <h3 className="text-sm font-bold text-black truncate">
                          {user.displayName}
                        </h3>
                        <span className="text-xs text-black tabular-nums">
                          · {user.friendsCount} friends
                        </span>
                      </div>
                      <p className="text-xs font-mono font-semibold text-black">
                        @{user.username}
                      </p>
                      <p className="text-xs text-black mt-1 line-clamp-2">{user.bio}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewUser(user)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#f0f2f5] hover:bg-slate-200 text-black text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-black" />
                      <span>View Profile</span>
                    </button>

                    {rel.status === 'friends' && (
                      <button
                        type="button"
                        onClick={() =>
                          onStartChat(user.uid, user.displayName, user.username, user.avatarUrl)
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#25d366] text-black text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-black" />
                        <span>Message</span>
                      </button>
                    )}

                    {rel.status === 'none' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onStartChat(user.uid, user.displayName, user.username, user.avatarUrl)
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#f0f2f5] hover:bg-slate-200 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-black" />
                          <span>Chat</span>
                        </button>
                        <button
                          type="button"
                          disabled={user.privacyWhoCanRequest === 'none'}
                          onClick={() => onSendFriendRequest(user)}
                          className="px-3 py-1.5 rounded-lg bg-[#25d366] disabled:opacity-50 text-black text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-black" />
                          <span>Add Friend</span>
                        </button>
                      </div>
                    )}

                    {rel.status === 'outgoing' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onCancelFriendRequest(rel.request!)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#f0f2f5] text-xs font-bold text-black hover:bg-red-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-black" />
                        <span>Cancel Request</span>
                      </button>
                    )}

                    {rel.status === 'incoming' && rel.request && (
                      <button
                        type="button"
                        onClick={() => onAcceptFriendRequest(rel.request!)}
                        className="px-3 py-1.5 rounded-lg bg-[#25d366] text-black text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-black" />
                        <span>Accept Request</span>
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-300 bg-white text-black p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={previewUser.avatarUrl}
                  alt={previewUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <h3 id="profile-preview-title" className="text-base font-bold text-black">
                    {previewUser.displayName}
                  </h3>
                  <p className="text-xs font-mono font-semibold text-black">
                    @{previewUser.username}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-black mt-1 tabular-nums">
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
                className="p-1.5 rounded-lg text-black hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            <p className="text-xs text-black leading-relaxed">
              {previewUser.bio || 'No bio provided.'}
            </p>

            <div className="p-3 rounded-xl bg-[#f0f2f5] text-xs text-black space-y-1">
              <div>
                <span className="font-bold text-black">Privacy Policy:</span> Email address and
                phone number are hidden by ConnectX PII Isolation.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onBlockUser(previewUser, 'Blocked from profile preview');
                    setPreviewUser(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-[#f0f2f5] hover:bg-red-100 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5 text-black" />
                  <span>Block</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = previewUser;
                    setPreviewUser(null);
                    onReportTarget(u.uid, `@${u.username}`, 'user');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-[#f0f2f5] hover:bg-amber-100 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-black" />
                  <span>Report</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewUser(null)}
                className="px-4 py-2 rounded-xl bg-[#25d366] text-black text-xs font-bold cursor-pointer"
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
