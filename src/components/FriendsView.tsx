import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  UserX,
  MessageSquare,
  Ban,
  Check,
  X,
  Compass,
  Phone,
  Video,
} from 'lucide-react';
import {
  CallType,
  FriendRequest,
  Friendship,
  UserBlock,
  UserPublicProfile,
} from '../types/connectx';
import { getDeterministicPairId } from '../utils/connectxRules';

interface FriendsViewProps {
  currentUser: UserPublicProfile;
  friendships: Friendship[];
  friendRequests: FriendRequest[];
  blocks: UserBlock[];
  onAcceptRequest: (request: FriendRequest) => void;
  onRejectRequest: (request: FriendRequest) => void;
  onCancelRequest: (request: FriendRequest) => void;
  onRemoveFriend: (friendship: Friendship) => void;
  onStartChatWithFriend: (
    friendUid: string,
    friendName: string,
    friendUsername: string,
    friendAvatar: string
  ) => void;
  onStartCallWithFriend: (
    chatId: string,
    friendUid: string,
    friendName: string,
    friendUsername: string,
    friendAvatar: string,
    callType: CallType
  ) => void;
  onUnblockUser: (blockId: string) => void;
  onNavigateToDiscover: () => void;
}

type FriendsSubTab = 'accepted' | 'incoming' | 'outgoing' | 'blocked';

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  friendships,
  friendRequests,
  blocks,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
  onRemoveFriend,
  onStartChatWithFriend,
  onStartCallWithFriend,
  onUnblockUser,
  onNavigateToDiscover,
}) => {
  const [subTab, setSubTab] = useState<FriendsSubTab>('accepted');

  const blockedUids = new Set(blocks.map((b) => b.blockedUid));

  const activeFriends = friendships.filter((f) => {
    const otherUid = f.user1Uid === currentUser.uid ? f.user2Uid : f.user1Uid;
    return !blockedUids.has(otherUid);
  });

  const incomingRequests = friendRequests.filter(
    (r) =>
      r.toUid === currentUser.uid &&
      r.status === 'pending' &&
      !blockedUids.has(r.fromUid)
  );

  const outgoingRequests = friendRequests.filter(
    (r) =>
      r.fromUid === currentUser.uid &&
      r.status === 'pending' &&
      !blockedUids.has(r.toUid)
  );

  return (
    <div className="space-y-6 text-black">
      {/* Header & Sub-Navigation */}
      <div className="p-6 rounded-2xl border border-slate-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black">Friends & Relationships</h1>
          <div className="flex items-center gap-2 text-xs font-medium text-black mt-1 tabular-nums">
            <span>{activeFriends.length} Accepted Friends</span>
            <span aria-hidden="true">·</span>
            <span>{incomingRequests.length} Incoming Requests</span>
            <span aria-hidden="true">·</span>
            <span>{outgoingRequests.length} Outgoing Pending</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToDiscover}
          className="px-4 py-2.5 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Compass className="w-4 h-4 text-black" />
          <span>Find Users by @Username</span>
        </button>
      </div>

      {/* Interactive Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white border border-slate-300 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('accepted')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer text-black ${
            subTab === 'accepted' ? 'bg-[#25d366]' : 'hover:bg-[#f0f2f5]'
          }`}
        >
          Accepted Friends ({activeFriends.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('incoming')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer text-black ${
            subTab === 'incoming' ? 'bg-[#25d366]' : 'hover:bg-[#f0f2f5]'
          }`}
        >
          Incoming Requests ({incomingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('outgoing')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer text-black ${
            subTab === 'outgoing' ? 'bg-[#25d366]' : 'hover:bg-[#f0f2f5]'
          }`}
        >
          Outgoing Pending ({outgoingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('blocked')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer text-black ${
            subTab === 'blocked' ? 'bg-[#25d366]' : 'hover:bg-[#f0f2f5]'
          }`}
        >
          Blocked Users ({blocks.length})
        </button>
      </div>

      {/* Tab Content */}
      {subTab === 'accepted' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeFriends.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-300 bg-white text-center space-y-2 text-black">
              <UserCheck className="w-8 h-8 text-black mx-auto" />
              <p className="text-sm font-bold text-black">No accepted friends yet</p>
              <p className="text-xs text-black">
                Accept an incoming request or discover real users by @username.
              </p>
            </div>
          ) : (
            activeFriends.map((f) => {
              const isUser1 = f.user1Uid === currentUser.uid;
              const friendUid = isUser1 ? f.user2Uid : f.user1Uid;
              const friendName = isUser1 ? f.user2DisplayName : f.user1DisplayName;
              const friendUsername = isUser1 ? f.user2Username : f.user1Username;
              const friendAvatar = isUser1 ? f.user2AvatarUrl : f.user1AvatarUrl;
              const chatId = getDeterministicPairId(currentUser.uid, friendUid);

              return (
                <div
                  key={f.friendshipId}
                  className="p-5 rounded-2xl border border-slate-300 bg-white flex flex-col justify-between gap-4 text-black"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={friendAvatar}
                      alt={friendName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-black truncate">{friendName}</h3>
                      <p className="text-xs text-black font-mono font-semibold truncate">
                        @{friendUsername}
                      </p>
                      <p className="text-[11px] text-black mt-0.5">
                        Connected · Voice, Video & Chat Ready
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        onStartChatWithFriend(friendUid, friendName, friendUsername, friendAvatar)
                      }
                      className="flex-1 py-2 px-3 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-black" />
                      <span>Chat</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Voice call ${friendName}`}
                      onClick={() =>
                        onStartCallWithFriend(
                          chatId,
                          friendUid,
                          friendName,
                          friendUsername,
                          friendAvatar,
                          'audio'
                        )
                      }
                      className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] border border-slate-300 text-black transition-colors cursor-pointer"
                      title="Voice Call"
                    >
                      <Phone className="w-4 h-4 text-black" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Video call ${friendName}`}
                      onClick={() =>
                        onStartCallWithFriend(
                          chatId,
                          friendUid,
                          friendName,
                          friendUsername,
                          friendAvatar,
                          'video'
                        )
                      }
                      className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] border border-slate-300 text-black transition-colors cursor-pointer"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4 text-black" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFriend(f)}
                      aria-label={`Remove ${friendName} from friends`}
                      className="py-2 px-2.5 rounded-xl border border-slate-300 hover:bg-red-100 text-black text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5 text-black" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === 'incoming' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incomingRequests.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-300 bg-white text-center space-y-2 text-black">
              <UserPlus className="w-8 h-8 text-black mx-auto" />
              <p className="text-sm font-bold text-black">No pending incoming requests</p>
              <p className="text-xs text-black">
                When someone sends you a friend request, only your UID is authorized to accept or
                decline it.
              </p>
            </div>
          ) : (
            incomingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-5 rounded-2xl border border-slate-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-black"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={req.fromAvatarUrl}
                    alt={req.fromDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-black">{req.fromDisplayName}</h3>
                    <p className="text-xs text-black font-mono font-semibold">
                      @{req.fromUsername}
                    </p>
                    <p className="text-[11px] text-black mt-0.5">Wants to connect with you</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAcceptRequest(req)}
                    className="px-4 py-2 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectRequest(req)}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-[#f0f2f5] hover:bg-slate-200 text-black text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-black" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'outgoing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outgoingRequests.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-300 bg-white text-center space-y-2 text-black">
              <p className="text-sm font-bold text-black">No outgoing requests pending</p>
              <p className="text-xs text-black">
                Requests you send to other users will appear here until they respond.
              </p>
            </div>
          ) : (
            outgoingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-5 rounded-2xl border border-slate-300 bg-white flex items-center justify-between gap-4 text-black"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={req.toAvatarUrl}
                    alt={req.toDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-black">{req.toDisplayName}</h3>
                    <p className="text-xs text-black font-mono font-semibold">@{req.toUsername}</p>
                    <p className="text-[11px] text-black mt-0.5">Awaiting recipient response</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCancelRequest(req)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-[#f0f2f5] hover:bg-red-100 text-black text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Cancel Request
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'blocked' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {blocks.length === 0 ? (
            <div className="col-span-full p-8 rounded-2xl border border-slate-300 bg-white text-center space-y-2 text-black">
              <Ban className="w-8 h-8 text-black mx-auto" />
              <p className="text-sm font-bold text-black">No blocked accounts</p>
              <p className="text-xs text-black">
                Blocked users cannot send you messages, calls, friend requests, or view your
                stories.
              </p>
            </div>
          ) : (
            blocks.map((b) => (
              <div
                key={b.blockId}
                className="p-5 rounded-2xl border border-slate-300 bg-white flex items-center justify-between gap-4 text-black"
              >
                <div>
                  <h3 className="text-sm font-bold text-black">{b.blockedDisplayName}</h3>
                  <p className="text-xs font-mono font-semibold text-black">
                    @{b.blockedUsername}
                  </p>
                  {b.reason && (
                    <p className="text-[11px] text-black mt-1">Reason: {b.reason}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onUnblockUser(b.blockId)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-[#f0f2f5] hover:bg-slate-200 text-black text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
