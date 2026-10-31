import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Send,
  Reply,
  Copy,
  Trash2,
  Image as ImageIcon,
  Check,
  CheckCheck,
  X,
  ArrowLeft,
  Clock,
  MessageSquarePlus,
  Flag,
  Ban,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  Lock,
  Bell,
  BellOff,
  Users,
  ShieldCheck,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import {
  CallLogEntry,
  CallType,
  ChatConversation,
  ChatMessage,
  GroupChat,
  GroupMessage,
  UserPublicProfile,
} from '../types/connectx';
import { formatCallDuration, validateMessagePayload } from '../utils/connectxRules';
import { createStoryVisualSvg } from '../utils/seedData';

interface ChatsViewProps {
  currentUser: UserPublicProfile;
  chats: ChatConversation[];
  messagesByChat: Record<string, ChatMessage[]>;
  activeChatId: string | null;
  blockedUids: Set<string>;
  directoryUsers: UserPublicProfile[];
  callLogs: CallLogEntry[];
  onSelectChat: (chatId: string | null) => void;
  onSendMessage: (
    chatId: string,
    text: string,
    mediaUrl: string,
    mediaType: 'none' | 'image',
    replyToMessageId: string,
    replyToText: string
  ) => void;
  onDeleteMessage: (chatId: string, messageId: string) => void;
  onStartCall: (
    chatId: string,
    peerUid: string,
    peerName: string,
    peerUsername: string,
    peerAvatar: string,
    callType: CallType
  ) => void;
  onBlockUser: (targetUser: UserPublicProfile, reason: string) => void;
  onReportTarget: (
    targetUid: string,
    targetLabel: string,
    targetType: 'user' | 'message' | 'story'
  ) => void;
  onNavigateToFriends: () => void;
  mutedChatIds?: string[];
  onToggleMuteChat?: (chatId: string) => void;
  groups?: GroupChat[];
  activeGroupId?: string | null;
  onSelectGroup?: (groupId: string | null) => void;
  onOpenCreateGroup?: () => void;
  onRetryMessage?: (chatId: string, message: ChatMessage) => void;
  isE2EEActive?: boolean;
}

type SidebarFilter = 'all' | 'unread' | 'groups' | 'calls';

export const ChatsView: React.FC<ChatsViewProps> = ({
  currentUser,
  chats,
  messagesByChat,
  activeChatId,
  blockedUids,
  directoryUsers,
  callLogs,
  onSelectChat,
  onSendMessage,
  onDeleteMessage,
  onStartCall,
  onBlockUser,
  onReportTarget,
  onNavigateToFriends,
  mutedChatIds = [],
  onToggleMuteChat,
  groups = [],
  activeGroupId = null,
  onSelectGroup,
  onOpenCreateGroup,
  onRetryMessage,
  isE2EEActive = true,
}) => {
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [draftsByChat, setDraftsByChat] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [simulatePeerTyping, setSimulatePeerTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentDraft = activeChatId ? draftsByChat[activeChatId] || '' : '';
  const setDraftText = (text: string) => {
    if (!activeChatId) return;
    setDraftsByChat((prev) => ({ ...prev, [activeChatId]: text }));
  };

  const visibleChats = chats.filter((c) => {
    const otherUid =
      c.participant1Uid === currentUser.uid ? c.participant2Uid : c.participant1Uid;
    if (blockedUids.has(otherUid)) return false;
    const isP1 = c.participant1Uid === currentUser.uid;
    const unread = isP1 ? c.unreadCount1 : c.unreadCount2;
    if (sidebarFilter === 'unread' && unread === 0) return false;

    const otherName =
      c.participant1Uid === currentUser.uid ? c.participant2Name : c.participant1Name;
    const otherUsername =
      c.participant1Uid === currentUser.uid ? c.participant2Username : c.participant1Username;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      otherName.toLowerCase().includes(q) ||
      otherUsername.toLowerCase().includes(q) ||
      c.lastMessageText.toLowerCase().includes(q)
    );
  });

  const activeChat = chats.find((c) => c.chatId === activeChatId) || null;
  const otherParticipantUid = activeChat
    ? activeChat.participant1Uid === currentUser.uid
      ? activeChat.participant2Uid
      : activeChat.participant1Uid
    : '';
  const otherParticipantName = activeChat
    ? activeChat.participant1Uid === currentUser.uid
      ? activeChat.participant2Name
      : activeChat.participant1Name
    : '';
  const otherParticipantUsername = activeChat
    ? activeChat.participant1Uid === currentUser.uid
      ? activeChat.participant2Username
      : activeChat.participant1Username
    : '';
  const otherParticipantAvatar = activeChat
    ? activeChat.participant1Uid === currentUser.uid
      ? activeChat.participant2Avatar
      : activeChat.participant1Avatar
    : '';

  const otherUserObj = directoryUsers.find((u) => u.uid === otherParticipantUid);

  const allChatMessages = activeChat ? messagesByChat[activeChat.chatId] || [] : [];
  const filteredMessages = messageSearch.trim()
    ? allChatMessages.filter((m) =>
        m.text.toLowerCase().includes(messageSearch.trim().toLowerCase())
      )
    : allChatMessages;
  const paginatedMessages = filteredMessages.slice(-visibleCount);
  const hasOlderMessages = filteredMessages.length > visibleCount;

  // Auto-scroll to bottom on chat switch or when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, paginatedMessages.length]);

  // Dynamically adjust textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [currentDraft]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChat || isSending) return;
    setErrorBanner(null);

    const trimmed = currentDraft.trim();
    const mediaType: 'none' | 'image' = selectedMediaUrl ? 'image' : 'none';
    if (!trimmed && !selectedMediaUrl) return;

    const check = validateMessagePayload(trimmed, selectedMediaUrl, mediaType);
    if (!check.valid) {
      setErrorBanner(check.error || 'Invalid message');
      return;
    }

    setIsSending(true);
    try {
      await onSendMessage(
        activeChat.chatId,
        trimmed,
        selectedMediaUrl,
        mediaType,
        replyingTo ? replyingTo.messageId : '',
        replyingTo ? replyingTo.text.slice(0, 140) : ''
      );

      setDraftText('');
      setSelectedMediaUrl('');
      setReplyingTo(null);
      setShowMediaPicker(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      setErrorBanner('Failed to send message. Please verify network connectivity.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    if (!file.type.startsWith('image/')) {
      setErrorBanner('Only image attachments (PNG, JPEG, WebP, SVG) are allowed.');
      return;
    }
    if (file.size > 35000) {
      setErrorBanner(
        'Selected image exceeds 35KB direct Firestore limit. Use one of the optimized studio attachments below or a smaller image.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedMediaUrl(reader.result);
        setShowMediaPicker(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyText = (msg: ChatMessage) => {
    if (navigator.clipboard && msg.text) {
      navigator.clipboard.writeText(msg.text).catch(() => {});
    }
    setCopiedMsgId(msg.messageId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-5.5rem)] rounded-2xl border border-slate-300 bg-white text-black overflow-hidden shadow-md">
      {/* Left Pane: WhatsApp-Styled Conversation & Calls List */}
      <aside
        className={`lg:col-span-4 border-r border-slate-300 bg-white flex flex-col text-black ${
          activeChat ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-300 bg-[#f0f2f5] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-black">Chats & Calls</h2>
            <button
              type="button"
              onClick={onNavigateToFriends}
              aria-label="New conversation from friends"
              className="text-xs font-bold text-black hover:underline flex items-center gap-1 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4 text-black" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, @username, or message..."
              className="w-full pl-9 pr-3 py-2 text-xs text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#25d366]"
            />
          </div>

          {/* WhatsApp Filter Bar: All | Unread | Groups | Calls */}
          <div className="flex items-center justify-between gap-1 pt-0.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-black ${
                  sidebarFilter === 'all'
                    ? 'bg-[#008C5A] text-white'
                    : 'bg-white border border-slate-300 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter('unread')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-black ${
                  sidebarFilter === 'unread'
                    ? 'bg-[#008C5A] text-white'
                    : 'bg-white border border-slate-300 hover:bg-slate-100'
                }`}
              >
                Unread
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter('groups')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer text-black ${
                  sidebarFilter === 'groups'
                    ? 'bg-[#008C5A] text-white'
                    : 'bg-white border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Groups ({groups.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter('calls')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer text-black ${
                  sidebarFilter === 'calls'
                    ? 'bg-[#008C5A] text-white'
                    : 'bg-white border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Phone className="w-3 h-3 text-black" />
                <span>Calls ({callLogs.length})</span>
              </button>
            </div>

            {onOpenCreateGroup && (
              <button
                type="button"
                onClick={onOpenCreateGroup}
                className="px-2.5 py-1.5 rounded-lg bg-[#008C5A]/15 hover:bg-[#008C5A]/25 text-[#006B46] text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                title="Create a new group"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Group</span>
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Scroll Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {sidebarFilter === 'groups' ? (
            groups.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-black">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-black">No Group Chats Yet</p>
                <p className="text-xs text-slate-500">
                  Create a shared space for team projects or group discussions.
                </p>
                {onOpenCreateGroup && (
                  <button
                    type="button"
                    onClick={onOpenCreateGroup}
                    className="mt-2 px-4 py-2 rounded-xl bg-[#008C5A] hover:bg-[#006B46] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Create Group
                  </button>
                )}
              </div>
            ) : (
              groups.map((grp) => {
                const isSelected = activeGroupId === grp.groupId;
                return (
                  <button
                    key={grp.groupId}
                    type="button"
                    onClick={() => {
                      if (onSelectGroup) onSelectGroup(grp.groupId);
                      onSelectChat(null);
                    }}
                    className={`w-full text-left p-4 transition-colors flex items-start gap-3.5 cursor-pointer text-black ${
                      isSelected ? 'bg-emerald-50' : 'hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-[#006B46] flex items-center justify-center font-bold text-sm shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-black truncate">{grp.name}</span>
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                          {formatTime(grp.updatedAt)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {grp.memberUids.length} members · Admin: {grp.creatorUid === currentUser.uid ? 'You' : 'Admin'}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1">
                        {grp.lastMessageText || 'Group created'}
                      </p>
                    </div>
                  </button>
                );
              })
            )
          ) : sidebarFilter === 'calls' ? (
            callLogs.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-black">
                <p className="text-sm font-bold text-black">No recent calls</p>
                <p className="text-xs text-black">
                  Tap the Voice or Video Call icons inside any conversation header to start a call.
                </p>
              </div>
            ) : (
              callLogs.map((call) => (
                <div
                  key={call.callId}
                  className="p-4 hover:bg-[#f0f2f5] transition-colors flex items-center justify-between gap-3 text-black"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={call.peerAvatar}
                      alt={call.peerName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-black truncate">{call.peerName}</div>
                      <div className="flex items-center gap-1.5 text-xs text-black mt-0.5 tabular-nums">
                        {call.direction === 'incoming' ? (
                          <PhoneIncoming className="w-3.5 h-3.5 text-black shrink-0" />
                        ) : (
                          <PhoneOutgoing className="w-3.5 h-3.5 text-black shrink-0" />
                        )}
                        <span>
                          {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}{' '}
                          {call.callType === 'video' ? 'video' : 'voice'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatCallDuration(call.durationSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Voice call ${call.peerName}`}
                      onClick={() =>
                        onStartCall(
                          call.chatId,
                          call.peerUid,
                          call.peerName,
                          call.peerUsername,
                          call.peerAvatar,
                          'audio'
                        )
                      }
                      className="p-2 rounded-xl bg-[#d9fdd3] hover:bg-[#25d366] text-black transition-colors cursor-pointer"
                      title="Start Voice Call"
                    >
                      <Phone className="w-4 h-4 text-black" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Video call ${call.peerName}`}
                      onClick={() =>
                        onStartCall(
                          call.chatId,
                          call.peerUid,
                          call.peerName,
                          call.peerUsername,
                          call.peerAvatar,
                          'video'
                        )
                      }
                      className="p-2 rounded-xl bg-[#d9fdd3] hover:bg-[#25d366] text-black transition-colors cursor-pointer"
                      title="Start Video Call"
                    >
                      <Video className="w-4 h-4 text-black" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : visibleChats.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-black">
              <p className="text-sm font-bold text-black">No conversations found</p>
              <p className="text-xs text-black">
                Connect with real users in the Discover or Friends tabs to start messaging.
              </p>
            </div>
          ) : (
            visibleChats.map((chat) => {
              const isP1 = chat.participant1Uid === currentUser.uid;
              const name = isP1 ? chat.participant2Name : chat.participant1Name;
              const handle = isP1 ? chat.participant2Username : chat.participant1Username;
              const avatar = isP1 ? chat.participant2Avatar : chat.participant1Avatar;
              const unread = isP1 ? chat.unreadCount1 : chat.unreadCount2;
              const isSelected = activeChat?.chatId === chat.chatId;

              return (
                <button
                  key={chat.chatId}
                  type="button"
                  onClick={() => onSelectChat(chat.chatId)}
                  className={`w-full text-left p-4 transition-colors flex items-start gap-3.5 cursor-pointer text-black ${
                    isSelected ? 'bg-[#d9fdd3]' : 'hover:bg-[#f0f2f5]'
                  }`}
                >
                  <img
                    src={avatar}
                    alt={name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover shrink-0 bg-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-black truncate">{name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mutedChatIds.includes(chat.chatId) && (
                          <BellOff className="w-3.5 h-3.5 text-slate-400" title="Notifications muted" />
                        )}
                        <span className="text-[11px] font-medium text-black tabular-nums">
                          {formatTime(chat.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-black font-mono font-semibold truncate">
                      @{handle}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-black truncate">
                        {chat.lastMessageSenderId === currentUser.uid && (
                          <span className="font-semibold text-black mr-1">You:</span>
                        )}
                        {chat.lastMessageText || 'Shared an image'}
                      </p>
                      {unread > 0 && (
                        <span className="text-xs font-bold text-black bg-[#25d366] px-2 py-0.5 rounded-md tabular-nums shrink-0">
                          {unread} new
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Pane: Active 1:1 Thread with WhatsApp Warm Cream Wallpaper & Black Text */}
      <section
        className={`lg:col-span-8 flex flex-col h-full bg-[#efeae2] text-black ${
          activeChat ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!activeChat ? (
          <div className="flex-1 wa-chat-wallpaper flex flex-col items-center justify-center p-8 text-center space-y-3 text-black">
            <p className="text-base font-bold text-black">Select a conversation</p>
            <p className="text-xs text-black max-w-sm">
              Choose a thread from the left list to send messages, start a voice or HD video call,
              or share media.
            </p>
          </div>
        ) : (
          <>
            {/* Thread Header with Voice & Video Call Buttons */}
            <div className="px-4 py-3 border-b border-slate-300 flex items-center justify-between gap-3 bg-[#f0f2f5] text-black">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  aria-label="Back to conversation list"
                  onClick={() => onSelectChat(null)}
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-200 text-black cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-black" />
                </button>
                <img
                  src={otherParticipantAvatar}
                  alt={otherParticipantName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-black truncate">
                    {otherParticipantName}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-black truncate">
                    <span className="font-mono font-semibold text-black truncate">
                      @{otherParticipantUsername}
                    </span>
                    <span aria-hidden="true" className="shrink-0">
                      ·
                    </span>
                    <span className="whitespace-nowrap shrink-0 text-black">
                      {simulatePeerTyping
                        ? 'typing...'
                        : otherUserObj?.privacyShowOnlineStatus && otherUserObj?.isOnline
                          ? 'online'
                          : 'private status'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* E2EE Active Indicator */}
                {isE2EEActive && (
                  <div
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#008C5A]/10 text-[#006B46] border border-[#008C5A]/25 text-[11px] font-bold shrink-0"
                    title="End-to-End Encrypted (ECDH Curve P-256 + AES-256-GCM)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#008C5A]" />
                    <span>E2EE Active</span>
                  </div>
                )}

                {/* Voice Call Button */}
                <button
                  type="button"
                  aria-label={`Start voice call with ${otherParticipantName}`}
                  onClick={() =>
                    onStartCall(
                      activeChat.chatId,
                      otherParticipantUid,
                      otherParticipantName,
                      otherParticipantUsername,
                      otherParticipantAvatar,
                      'audio'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-3.5 h-3.5 text-black" />
                  <span>Voice Call</span>
                </button>

                {/* Video Call Button */}
                <button
                  type="button"
                  aria-label={`Start video call with ${otherParticipantName}`}
                  onClick={() =>
                    onStartCall(
                      activeChat.chatId,
                      otherParticipantUid,
                      otherParticipantName,
                      otherParticipantUsername,
                      otherParticipantAvatar,
                      'video'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-black text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-3.5 h-3.5 text-black" />
                  <span>Video Call</span>
                </button>

                {/* Mute/Unmute Notifications for Chat */}
                {onToggleMuteChat && (
                  <button
                    type="button"
                    aria-label={
                      mutedChatIds.includes(activeChat.chatId)
                        ? 'Unmute notifications'
                        : 'Mute notifications'
                    }
                    onClick={() => onToggleMuteChat(activeChat.chatId)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mutedChatIds.includes(activeChat.chatId)
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-white border-slate-300 hover:bg-slate-100 text-black'
                    }`}
                    title={
                      mutedChatIds.includes(activeChat.chatId)
                        ? 'Unmute notifications for this conversation'
                        : 'Mute notifications for this conversation'
                    }
                  >
                    {mutedChatIds.includes(activeChat.chatId) ? (
                      <>
                        <BellOff className="w-3.5 h-3.5 text-amber-700" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5 text-slate-700" />
                        <span>Mute</span>
                      </>
                    )}
                  </button>
                )}

                <input
                  type="text"
                  aria-label="Search within conversation"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Find in chat..."
                  className="hidden xl:block w-32 px-2.5 py-1.5 text-xs text-black placeholder:text-black/60 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                />
                <button
                  type="button"
                  onClick={() => setSimulatePeerTyping((v) => !v)}
                  className="hidden md:inline-flex px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-black text-xs font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Toggle peer typing state"
                >
                  {simulatePeerTyping ? 'Stop Typing' : 'Typing Sim'}
                </button>
                <button
                  type="button"
                  aria-label={`Report ${otherParticipantName}`}
                  onClick={() =>
                    onReportTarget(otherParticipantUid, `@${otherParticipantUsername}`, 'user')
                  }
                  className="p-2 rounded-lg text-black hover:bg-slate-200 cursor-pointer"
                  title="Report user"
                >
                  <Flag className="w-4 h-4 text-black" />
                </button>
                {otherUserObj && (
                  <button
                    type="button"
                    aria-label={`Block ${otherParticipantName}`}
                    onClick={() => onBlockUser(otherUserObj, 'Blocked from conversation header')}
                    className="p-2 rounded-lg text-black hover:bg-slate-200 cursor-pointer"
                    title="Block user"
                  >
                    <Ban className="w-4 h-4 text-black" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Scroll Area with WhatsApp Warm Cream Ambiance & Black Text */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 wa-chat-wallpaper text-black">
              {/* WhatsApp-Style Security Notice */}
              <div className="mx-auto max-w-md px-3.5 py-2 rounded-xl bg-[#fef3c7] border border-amber-300 text-center text-[11px] font-medium text-black flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-black shrink-0" />
                <span>
                  Messages and calls in this chat are protected by participant-gated Firestore rules.
                </span>
              </div>

              {hasOlderMessages && (
                <div className="text-center pb-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + 15)}
                    className="px-3 py-1.5 text-xs font-bold text-black underline cursor-pointer"
                  >
                    Load earlier messages
                  </button>
                </div>
              )}

              {paginatedMessages.length === 0 ? (
                <div className="py-12 text-center text-xs font-medium text-black">
                  No messages match your filter. Say hello below!
                </div>
              ) : (
                paginatedMessages.map((msg) => {
                  const isMine = msg.senderId === currentUser.uid;
                  return (
                    <div
                      key={msg.messageId}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1.5 shadow-xs border ${
                          isMine
                            ? 'bg-[#d9fdd3] border-emerald-300 text-black rounded-br-xs'
                            : 'bg-white border-slate-300 text-black rounded-bl-xs'
                        }`}
                      >
                        {msg.replyToText && !msg.isDeleted && (
                          <div className="text-xs px-2.5 py-1.5 rounded-lg bg-black/5 text-black border-l-2 border-black">
                            <span className="font-bold block text-[10px] text-black">
                              Replying to:
                            </span>
                            <span className="line-clamp-1 text-black">{msg.replyToText}</span>
                          </div>
                        )}

                        {msg.mediaType === 'image' && msg.mediaUrl && !msg.isDeleted && (
                          <div className="rounded-xl overflow-hidden my-1 border border-slate-300">
                            <img
                              src={msg.mediaUrl}
                              alt="Shared attachment"
                              referrerPolicy="no-referrer"
                              className="max-h-60 w-auto object-cover"
                            />
                          </div>
                        )}

                        <p
                          className={`text-sm leading-relaxed break-words text-black ${
                            msg.isDeleted ? 'italic text-xs' : ''
                          }`}
                        >
                          {msg.isDeleted ? 'This message was deleted by sender.' : msg.text}
                        </p>

                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium tabular-nums text-black">
                          {msg.isEncrypted && (
                            <Lock className="w-3 h-3 text-[#008C5A]" title="End-to-End Encrypted message" />
                          )}
                          <span>{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            <span className="inline-flex items-center gap-0.5" title={msg.status}>
                              {msg.status === 'sending' ? (
                                <Clock className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                              ) : msg.status === 'failed' ? (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Failed</span>
                                </span>
                              ) : msg.status === 'read' && currentUser.privacyShowReadReceipts ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#008C5A]" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              {msg.status !== 'failed' && <span>{msg.status}</span>}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message Action Bar */}
                      {!msg.isDeleted && (
                        <div className="flex items-center gap-2.5 mt-1 px-1 text-[11px] font-semibold text-black">
                          {msg.status === 'failed' && onRetryMessage && (
                            <button
                              type="button"
                              onClick={() => onRetryMessage(activeChat.chatId, msg)}
                              className="hover:underline flex items-center gap-1 cursor-pointer text-rose-600 font-bold"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Retry Send</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="hover:underline flex items-center gap-1 cursor-pointer text-black"
                          >
                            <Reply className="w-3 h-3 text-black" />
                            <span>Reply</span>
                          </button>
                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg)}
                              className="hover:underline flex items-center gap-1 cursor-pointer text-black"
                            >
                              <Copy className="w-3 h-3 text-black" />
                              <span>{copiedMsgId === msg.messageId ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                          {isMine ? (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(activeChat.chatId, msg.messageId)}
                              className="hover:underline flex items-center gap-1 cursor-pointer text-black"
                            >
                              <Trash2 className="w-3 h-3 text-black" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onReportTarget(
                                  msg.senderId,
                                  `Message: "${msg.text.slice(0, 40)}"`,
                                  'message'
                                )
                              }
                              className="hover:underline flex items-center gap-1 cursor-pointer text-black"
                            >
                              <Flag className="w-3 h-3 text-black" />
                              <span>Report</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {simulatePeerTyping && (
                <div className="flex items-center gap-2 text-xs font-semibold text-black px-2">
                  <Clock className="w-3.5 h-3.5 text-black animate-spin" />
                  <span>{otherParticipantName} is typing a response...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply / Media Preview Bars */}
            {errorBanner && (
              <div className="px-4 py-2 bg-red-100 border-t border-red-300 text-xs text-black flex items-center justify-between">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="font-bold underline cursor-pointer text-black"
                >
                  Dismiss
                </button>
              </div>
            )}

            {replyingTo && (
              <div className="px-4 py-2 bg-[#f0f2f5] border-t border-slate-300 flex items-center justify-between text-xs text-black">
                <div className="truncate pr-4">
                  <span className="font-bold text-black mr-1.5">Replying to message:</span>
                  <span className="text-black">{replyingTo.text}</span>
                </div>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  onClick={() => setReplyingTo(null)}
                  className="text-black cursor-pointer"
                >
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>
            )}

            {selectedMediaUrl && (
              <div className="px-4 py-2 bg-[#f0f2f5] border-t border-slate-300 flex items-center justify-between text-xs text-black">
                <div className="flex items-center gap-2">
                  <img
                    src={selectedMediaUrl}
                    alt="Attachment preview"
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <span className="font-bold text-black">Validated image attachment ready</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMediaUrl('')}
                  className="text-xs font-bold text-black underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            {showMediaPicker && (
              <div className="p-3 bg-[#f0f2f5] border-t border-slate-300 space-y-2 text-black">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-black">
                    Share Validated Image (Max 35KB inline or Studio Preset)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(false)}
                    className="text-black font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-black text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMediaUrl(createStoryVisualSvg('geometry', 'System Architecture'));
                      setShowMediaPicker(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#d9fdd3] border border-emerald-400 text-black text-xs font-bold hover:bg-[#25d366] cursor-pointer"
                  >
                    Attach Architecture Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMediaUrl(createStoryVisualSvg('sunset', 'Evening Horizon'));
                      setShowMediaPicker(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#d9fdd3] border border-emerald-400 text-black text-xs font-bold hover:bg-[#25d366] cursor-pointer"
                  >
                    Attach Horizon Visual
                  </button>
                </div>
              </div>
            )}

            {/* WhatsApp-Style Composer Form with Auto-expanding Textarea & Keyboard Protection */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-slate-300 flex items-end gap-2 bg-[#f0f2f5]"
            >
              <button
                type="button"
                aria-label="Attach image"
                onClick={() => setShowMediaPicker((v) => !v)}
                className="p-2.5 rounded-xl border border-slate-300 bg-white text-black hover:bg-slate-100 transition-colors cursor-pointer shrink-0 mb-0.5"
              >
                <ImageIcon className="w-4 h-4 text-black" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  aria-label="Message input"
                  maxLength={2000}
                  value={currentDraft}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${otherParticipantName}... (Shift+Enter for newline)`}
                  className="w-full px-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#25d366] resize-none overflow-y-auto max-h-32 transition-all leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isSending || (!currentDraft.trim() && !selectedMediaUrl)}
                aria-label="Send message"
                className={`px-4 py-2.5 rounded-xl text-black text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer mb-0.5 ${
                  isSending || (!currentDraft.trim() && !selectedMediaUrl)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#25d366] hover:bg-[#1ebe5d] active:scale-95 text-black shadow-xs'
                }`}
              >
                {isSending ? (
                  <>
                    <span>Sending</span>
                    <Clock className="w-3.5 h-3.5 text-black animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5 text-black" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};
