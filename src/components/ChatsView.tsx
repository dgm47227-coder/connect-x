import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  ChatConversation,
  ChatMessage,
  UserPublicProfile,
} from '../types/connectx';
import { validateMessagePayload } from '../utils/connectxRules';
import { createStoryVisualSvg } from '../utils/seedData';

interface ChatsViewProps {
  currentUser: UserPublicProfile;
  chats: ChatConversation[];
  messagesByChat: Record<string, ChatMessage[]>;
  activeChatId: string | null;
  blockedUids: Set<string>;
  directoryUsers: UserPublicProfile[];
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
  onBlockUser: (targetUser: UserPublicProfile, reason: string) => void;
  onReportTarget: (
    targetUid: string,
    targetLabel: string,
    targetType: 'user' | 'message' | 'story'
  ) => void;
  onNavigateToFriends: () => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  currentUser,
  chats,
  messagesByChat,
  activeChatId,
  blockedUids,
  directoryUsers,
  onSelectChat,
  onSendMessage,
  onDeleteMessage,
  onBlockUser,
  onReportTarget,
  onNavigateToFriends,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [draftText, setDraftText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const [simulatePeerTyping, setSimulatePeerTyping] = useState(false);

  const visibleChats = chats.filter((c) => {
    const otherUid =
      c.participant1Uid === currentUser.uid ? c.participant2Uid : c.participant1Uid;
    if (blockedUids.has(otherUid)) return false;
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat) return;
    setErrorBanner(null);

    const mediaType: 'none' | 'image' = selectedMediaUrl ? 'image' : 'none';
    const check = validateMessagePayload(draftText, selectedMediaUrl, mediaType);
    if (!check.valid) {
      setErrorBanner(check.error || 'Invalid message');
      return;
    }

    onSendMessage(
      activeChat.chatId,
      draftText.trim(),
      selectedMediaUrl,
      mediaType,
      replyingTo ? replyingTo.messageId : '',
      replyingTo ? replyingTo.text.slice(0, 140) : ''
    );

    setDraftText('');
    setSelectedMediaUrl('');
    setReplyingTo(null);
    setShowMediaPicker(false);
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
    <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-5.5rem)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Left Pane: Conversation List */}
      <aside
        className={`lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col ${
          activeChat ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Messages</h2>
            <button
              type="button"
              onClick={onNavigateToFriends}
              aria-label="New conversation from friends"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, @username, or message..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {visibleChats.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No conversations found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with friends in the Friends or Discover tabs to start messaging.
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
                  className={`w-full text-left p-4 transition-colors flex items-start gap-3.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <img
                    src={avatar}
                    alt={name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover shrink-0 bg-indigo-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{name}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {formatTime(chat.updatedAt)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">@{handle}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {chat.lastMessageSenderId === currentUser.uid && (
                          <span className="text-slate-400 mr-1">You:</span>
                        )}
                        {chat.lastMessageText || 'Shared an image'}
                      </p>
                      {unread > 0 && (
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
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

      {/* Right Pane: Active 1:1 Thread */}
      <section
        className={`lg:col-span-8 flex flex-col h-full ${
          activeChat ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <p className="text-base font-bold text-slate-700 dark:text-slate-200">
              Select a conversation
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Choose a thread from the left list to read messages, reply inline, or share media.
              Only verified conversation participants can read or write messages.
            </p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  aria-label="Back to conversation list"
                  onClick={() => onSelectChat(null)}
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <img
                  src={otherParticipantAvatar}
                  alt={otherParticipantName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{otherParticipantName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span className="font-mono truncate">@{otherParticipantUsername}</span>
                    <span aria-hidden="true" className="shrink-0">·</span>
                    <span className="whitespace-nowrap shrink-0">
                      {simulatePeerTyping
                        ? 'typing...'
                        : otherUserObj?.privacyShowOnlineStatus && otherUserObj?.isOnline
                          ? 'Active now'
                          : 'Private status'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <input
                  type="text"
                  aria-label="Search within conversation"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Find in chat..."
                  className="hidden md:block w-36 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setSimulatePeerTyping((v) => !v)}
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Toggle peer typing state"
                >
                  {simulatePeerTyping ? 'Stop Typing Sim' : 'Test Typing'}
                </button>
                <button
                  type="button"
                  aria-label={`Report ${otherParticipantName}`}
                  onClick={() =>
                    onReportTarget(otherParticipantUid, `@${otherParticipantUsername}`, 'user')
                  }
                  className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Report user"
                >
                  <Flag className="w-4 h-4" />
                </button>
                {otherUserObj && (
                  <button
                    type="button"
                    aria-label={`Block ${otherParticipantName}`}
                    onClick={() => onBlockUser(otherUserObj, 'Blocked from conversation header')}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Block user"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
              {hasOlderMessages && (
                <div className="text-center pb-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + 15)}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Load earlier messages
                  </button>
                </div>
              )}

              {paginatedMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
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
                        className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 space-y-1.5 ${
                          isMine
                            ? 'bg-indigo-600 text-white rounded-br-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-xs'
                        }`}
                      >
                        {msg.replyToText && !msg.isDeleted && (
                          <div
                            className={`text-xs px-2.5 py-1.5 rounded-lg opacity-90 ${
                              isMine
                                ? 'bg-indigo-700/80 text-indigo-100'
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-semibold block text-[10px]">Replying to:</span>
                            <span className="line-clamp-1">{msg.replyToText}</span>
                          </div>
                        )}

                        {msg.mediaType === 'image' && msg.mediaUrl && !msg.isDeleted && (
                          <div className="rounded-xl overflow-hidden my-1 border border-black/10">
                            <img
                              src={msg.mediaUrl}
                              alt="Shared attachment"
                              referrerPolicy="no-referrer"
                              className="max-h-60 w-auto object-cover"
                            />
                          </div>
                        )}

                        <p
                          className={`text-sm leading-relaxed break-words ${
                            msg.isDeleted ? 'italic opacity-75 text-xs' : ''
                          }`}
                        >
                          {msg.isDeleted ? 'This message was deleted by sender.' : msg.text}
                        </p>

                        <div
                          className={`flex items-center justify-end gap-2 text-[11px] tabular-nums ${
                            isMine ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          <span>{formatTime(msg.createdAt)}</span>
                          {isMine && currentUser.privacyShowReadReceipts && (
                            <span className="inline-flex items-center gap-0.5" title={msg.status}>
                              {msg.status === 'read' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{msg.status}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message Action Bar */}
                      {!msg.isDeleted && (
                        <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg)}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedMsgId === msg.messageId ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                          {isMine ? (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(activeChat.chatId, msg.messageId)}
                              className="hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
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
                              className="hover:text-amber-600 flex items-center gap-1 cursor-pointer"
                            >
                              <Flag className="w-3 h-3" />
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
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-2">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>{otherParticipantName} is typing a response...</span>
                </div>
              )}
            </div>

            {/* Reply / Media Preview Bars */}
            {errorBanner && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-950/60 border-t border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="font-semibold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {replyingTo && (
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="truncate pr-4">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 mr-1.5">
                    Replying to message:
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{replyingTo.text}</span>
                </div>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {selectedMediaUrl && (
              <div className="px-4 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 border-t border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img
                    src={selectedMediaUrl}
                    alt="Attachment preview"
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <span className="font-medium text-indigo-900 dark:text-indigo-200">
                    Validated image attachment ready
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMediaUrl('')}
                  className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            {showMediaPicker && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    Share Validated Image (Max 35KB inline or Studio Preset)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(false)}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:border-indigo-500">
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
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-600/20 cursor-pointer"
                  >
                    Attach Architecture Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMediaUrl(createStoryVisualSvg('sunset', 'Evening Horizon'));
                      setShowMediaPicker(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-600/20 cursor-pointer"
                  >
                    Attach Horizon Visual
                  </button>
                </div>
              </div>
            )}

            {/* Composer Form */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
            >
              <button
                type="button"
                aria-label="Attach image"
                onClick={() => setShowMediaPicker((v) => !v)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                type="text"
                aria-label="Message input"
                maxLength={2000}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={`Message ${otherParticipantName}...`}
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="submit"
                aria-label="Send message"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};
