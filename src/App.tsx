import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Users,
  Compass,
  Sparkles,
  User,
  Bell,
  Sun,
  Moon,
  X,
  Flag,
  Check,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  deleteUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AbuseReport,
  ChatConversation,
  ChatMessage,
  FriendRequest,
  Friendship,
  NavTab,
  StoryAudience,
  StoryItem,
  UserBlock,
  UserNotification,
  UserPrivateSettings,
  UserPublicProfile,
} from './types/connectx';
import {
  getDeterministicPairId,
  getDirectedRequestId,
  formatNotificationPreview,
} from './utils/connectxRules';
import {
  INITIAL_BLOCKS,
  INITIAL_CHATS,
  INITIAL_CURRENT_USER,
  INITIAL_DIRECTORY_USERS,
  INITIAL_FRIEND_REQUESTS,
  INITIAL_FRIENDSHIPS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PRIVATE_SETTINGS,
  INITIAL_REPORTS,
  INITIAL_STORIES,
  createAvatarSvg,
} from './utils/seedData';
import { AuthScreen } from './components/AuthScreen';
import { ChatsView } from './components/ChatsView';
import { FriendsView } from './components/FriendsView';
import { DiscoverView } from './components/DiscoverView';
import { StoriesView } from './components/StoriesView';
import { ProfileView } from './components/ProfileView';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [sandboxAuthenticated, setSandboxAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [currentUser, setCurrentUser] = useState<UserPublicProfile>(INITIAL_CURRENT_USER);
  const [privateSettings, setPrivateSettings] =
    useState<UserPrivateSettings>(INITIAL_PRIVATE_SETTINGS);
  const [directoryUsers, setDirectoryUsers] =
    useState<UserPublicProfile[]>(INITIAL_DIRECTORY_USERS);
  const [friendships, setFriendships] = useState<Friendship[]>(INITIAL_FRIENDSHIPS);
  const [friendRequests, setFriendRequests] =
    useState<FriendRequest[]>(INITIAL_FRIEND_REQUESTS);
  const [chats, setChats] = useState<ChatConversation[]>(INITIAL_CHATS);
  const [messagesByChat, setMessagesByChat] =
    useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    INITIAL_CHATS[0]?.chatId || null
  );
  const [stories, setStories] = useState<StoryItem[]>(INITIAL_STORIES);
  const [blocks, setBlocks] = useState<UserBlock[]>(INITIAL_BLOCKS);
  const [reports, setReports] = useState<AbuseReport[]>(INITIAL_REPORTS);
  const [notifications, setNotifications] =
    useState<UserNotification[]>(INITIAL_NOTIFICATIONS);

  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [reportModalTarget, setReportModalTarget] = useState<{
    targetUid: string;
    targetLabel: string;
    targetType: 'user' | 'message' | 'story';
  } | null>(null);
  const [reportCategory, setReportCategory] =
    useState<AbuseReport['reasonCategory']>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Sync dark mode class on documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        const handleBase = (user.email?.split('@')[0] || 'connectx_user')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 24);
        const handle = handleBase.length >= 3 ? handleBase : `user_${handleBase}`;
        const displayName = user.displayName || handle;
        const initials = displayName.slice(0, 2).toUpperCase();

        setCurrentUser((prev) => ({
          ...prev,
          uid: user.uid,
          username: prev.uid === user.uid ? prev.username : handle,
          displayName: prev.uid === user.uid ? prev.displayName : displayName,
          avatarUrl: createAvatarSvg(initials, '#2563eb', '#4f46e5'),
        }));
        setPrivateSettings((prev) => ({
          ...prev,
          uid: user.uid,
          email: user.email || prev.email,
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listener when authenticated with Firebase Auth
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const publicUsersQuery = query(
      collection(db, 'users'),
      where('isPublicProfile', '==', true)
    );
    const unsubUsers = onSnapshot(
      publicUsersQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteUsers: UserPublicProfile[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteUsers.push({
              uid: String(data.uid || docSnap.id),
              username: String(data.username || 'user'),
              displayName: String(data.displayName || 'User'),
              bio: String(data.bio || ''),
              avatarUrl: String(data.avatarUrl || createAvatarSvg('CX', '#2563eb', '#4f46e5')),
              friendsCount: Number(data.friendsCount || 0),
              privacyWhoCanRequest: data.privacyWhoCanRequest === 'none' ? 'none' : 'everyone',
              privacyStoryAudience: data.privacyStoryAudience === 'public' ? 'public' : 'friends',
              privacyShowReadReceipts: Boolean(data.privacyShowReadReceipts),
              privacyShowOnlineStatus: Boolean(data.privacyShowOnlineStatus),
              isPublicProfile: Boolean(data.isPublicProfile),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
          setDirectoryUsers((prev) => {
            const byUid = new Map(prev.map((u) => [u.uid, u]));
            remoteUsers.forEach((ru) => byUid.set(ru.uid, ru));
            return Array.from(byUid.values());
          });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch {
          // Logged via structured FirestoreErrorInfo
        }
      }
    );

    return () => {
      unsubUsers();
    };
  }, [authReady, firebaseUser]);

  const isAuthenticated = Boolean(firebaseUser) || sandboxAuthenticated;

  const existingUsernames = new Set(
    directoryUsers.map((u) => u.username.toLowerCase())
  );

  const blockedUids = new Set(blocks.map((b) => b.blockedUid));
  const friendUids = new Set(
    friendships.map((f) => (f.user1Uid === currentUser.uid ? f.user2Uid : f.user1Uid))
  );

  const unreadChatsCount = chats.reduce((acc, c) => {
    const otherUid =
      c.participant1Uid === currentUser.uid ? c.participant2Uid : c.participant1Uid;
    if (blockedUids.has(otherUid)) return acc;
    const count = c.participant1Uid === currentUser.uid ? c.unreadCount1 : c.unreadCount2;
    return acc + count;
  }, 0);

  const pendingIncomingRequestsCount = friendRequests.filter(
    (r) =>
      r.toUid === currentUser.uid &&
      r.status === 'pending' &&
      !blockedUids.has(r.fromUid)
  ).length;

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const handleEnterSandbox = (customProfile?: {
    username: string;
    displayName: string;
    bio: string;
    email: string;
  }) => {
    if (customProfile) {
      const initials =
        customProfile.displayName
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'CX';
      const updatedUser: UserPublicProfile = {
        ...currentUser,
        username: customProfile.username,
        displayName: customProfile.displayName,
        bio: customProfile.bio,
        avatarUrl: createAvatarSvg(initials, '#2563eb', '#4f46e5'),
      };
      setCurrentUser(updatedUser);
      setPrivateSettings((prev) => ({
        ...prev,
        email: customProfile.email,
      }));
    }
    setSandboxAuthenticated(true);
  };

  const handleSelectChat = (chatId: string | null) => {
    setActiveChatId(chatId);
    if (chatId) {
      setChats((prev) =>
        prev.map((c) => {
          if (c.chatId !== chatId) return c;
          const isP1 = c.participant1Uid === currentUser.uid;
          return {
            ...c,
            unreadCount1: isP1 ? 0 : c.unreadCount1,
            unreadCount2: !isP1 ? 0 : c.unreadCount2,
            lastMessageStatus: 'read',
          };
        })
      );
    }
  };

  const handleSendMessage = async (
    chatId: string,
    text: string,
    mediaUrl: string,
    mediaType: 'none' | 'image',
    replyToMessageId: string,
    replyToText: string
  ) => {
    const targetChat = chats.find((c) => c.chatId === chatId);
    if (!targetChat) return;

    const recipientId =
      targetChat.participant1Uid === currentUser.uid
        ? targetChat.participant2Uid
        : targetChat.participant1Uid;

    if (blockedUids.has(recipientId)) {
      showToast('Cannot message a blocked account.');
      return;
    }

    const nowIso = new Date().toISOString();
    const messageId = `msg_${Date.now()}`;
    const newMsg: ChatMessage = {
      messageId,
      chatId,
      senderId: currentUser.uid,
      recipientId,
      text,
      mediaUrl,
      mediaType,
      replyToMessageId,
      replyToText,
      status: 'delivered',
      isDeleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg],
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.chatId === chatId
          ? {
              ...c,
              lastMessageText: text || 'Shared an image attachment',
              lastMessageSenderId: currentUser.uid,
              lastMessageStatus: 'delivered',
              updatedAt: nowIso,
            }
          : c
      )
    );

    if (firebaseUser && firebaseUser.emailVerified) {
      try {
        await setDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          ...newMsg,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}/messages/${messageId}`);
        } catch {
          // Handled
        }
      }
    }
  };

  const handleDeleteMessage = async (chatId: string, messageId: string) => {
    const nowIso = new Date().toISOString();
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) =>
        m.messageId === messageId && m.senderId === currentUser.uid
          ? {
              ...m,
              text: '',
              mediaUrl: '',
              mediaType: 'none',
              isDeleted: true,
              updatedAt: nowIso,
            }
          : m
      ),
    }));
    showToast('Message deleted.');

    if (firebaseUser && firebaseUser.emailVerified) {
      try {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          text: '',
          mediaUrl: '',
          mediaType: 'none',
          isDeleted: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
        } catch {
          // Handled
        }
      }
    }
  };

  const handleAcceptFriendRequest = (req: FriendRequest) => {
    if (req.toUid !== currentUser.uid || req.status !== 'pending') return;

    const nowIso = new Date().toISOString();
    setFriendRequests((prev) =>
      prev.map((r) =>
        r.requestId === req.requestId ? { ...r, status: 'accepted', updatedAt: nowIso } : r
      )
    );

    const friendshipId = getDeterministicPairId(req.fromUid, req.toUid);
    const isCurrentFirst = currentUser.uid < req.fromUid;

    const newFriendship: Friendship = {
      friendshipId,
      user1Uid: isCurrentFirst ? currentUser.uid : req.fromUid,
      user2Uid: isCurrentFirst ? req.fromUid : currentUser.uid,
      user1Username: isCurrentFirst ? currentUser.username : req.fromUsername,
      user2Username: isCurrentFirst ? req.fromUsername : currentUser.username,
      user1DisplayName: isCurrentFirst ? currentUser.displayName : req.fromDisplayName,
      user2DisplayName: isCurrentFirst ? req.fromDisplayName : currentUser.displayName,
      user1AvatarUrl: isCurrentFirst ? currentUser.avatarUrl : req.fromAvatarUrl,
      user2AvatarUrl: isCurrentFirst ? req.fromAvatarUrl : currentUser.avatarUrl,
      status: 'active',
      createdAt: nowIso,
    };

    setFriendships((prev) => {
      if (prev.some((f) => f.friendshipId === friendshipId)) return prev;
      return [newFriendship, ...prev];
    });

    setCurrentUser((prev) => ({
      ...prev,
      friendsCount: prev.friendsCount + 1,
    }));

    setNotifications((prev) => [
      {
        notificationId: `notif_${Date.now()}`,
        recipientUid: currentUser.uid,
        actorUid: req.fromUid,
        actorName: req.fromDisplayName,
        actorUsername: req.fromUsername,
        type: 'friend_accepted',
        previewText: `You and ${req.fromDisplayName} (@${req.fromUsername}) are now connected.`,
        isRead: false,
        createdAt: nowIso,
      },
      ...prev,
    ]);

    showToast(`Accepted friend request from @${req.fromUsername}`);
  };

  const handleRejectFriendRequest = (req: FriendRequest) => {
    if (req.toUid !== currentUser.uid || req.status !== 'pending') return;
    setFriendRequests((prev) =>
      prev.map((r) =>
        r.requestId === req.requestId
          ? { ...r, status: 'rejected', updatedAt: new Date().toISOString() }
          : r
      )
    );
    showToast(`Declined friend request from @${req.fromUsername}`);
  };

  const handleCancelFriendRequest = (req: FriendRequest) => {
    if (req.fromUid !== currentUser.uid || req.status !== 'pending') return;
    setFriendRequests((prev) =>
      prev.map((r) =>
        r.requestId === req.requestId
          ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() }
          : r
      )
    );
    showToast(`Cancelled outgoing request to @${req.toUsername}`);
  };

  const handleSendFriendRequest = (targetUser: UserPublicProfile) => {
    if (blockedUids.has(targetUser.uid)) {
      showToast('Cannot send request to a blocked user.');
      return;
    }
    if (targetUser.privacyWhoCanRequest === 'none') {
      showToast(`@${targetUser.username} has paused incoming friend requests.`);
      return;
    }
    const existingPending = friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUid === currentUser.uid && r.toUid === targetUser.uid) ||
          (r.fromUid === targetUser.uid && r.toUid === currentUser.uid))
    );
    if (existingPending) {
      showToast('A friend request is already pending with this user.');
      return;
    }

    const nowIso = new Date().toISOString();
    const requestId = getDirectedRequestId(currentUser.uid, targetUser.uid);
    const newReq: FriendRequest = {
      requestId,
      fromUid: currentUser.uid,
      fromUsername: currentUser.username,
      fromDisplayName: currentUser.displayName,
      fromAvatarUrl: currentUser.avatarUrl,
      toUid: targetUser.uid,
      toUsername: targetUser.username,
      toDisplayName: targetUser.displayName,
      toAvatarUrl: targetUser.avatarUrl,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setFriendRequests((prev) => [newReq, ...prev]);
    showToast(`Friend request sent to @${targetUser.username}`);
  };

  const handleRemoveFriend = (friendship: Friendship) => {
    setFriendships((prev) => prev.filter((f) => f.friendshipId !== friendship.friendshipId));
    setCurrentUser((prev) => ({
      ...prev,
      friendsCount: Math.max(0, prev.friendsCount - 1),
    }));
    showToast('Friend removed.');
  };

  const handleStartChatWithUser = (
    otherUid: string,
    otherName: string,
    otherUsername: string,
    otherAvatar: string
  ) => {
    const chatId = getDeterministicPairId(currentUser.uid, otherUid);
    const existing = chats.find((c) => c.chatId === chatId);
    if (!existing) {
      const isCurrentFirst = currentUser.uid < otherUid;
      const nowIso = new Date().toISOString();
      const newChat: ChatConversation = {
        chatId,
        participant1Uid: isCurrentFirst ? currentUser.uid : otherUid,
        participant2Uid: isCurrentFirst ? otherUid : currentUser.uid,
        participant1Name: isCurrentFirst ? currentUser.displayName : otherName,
        participant2Name: isCurrentFirst ? otherName : currentUser.displayName,
        participant1Username: isCurrentFirst ? currentUser.username : otherUsername,
        participant2Username: isCurrentFirst ? otherUsername : currentUser.username,
        participant1Avatar: isCurrentFirst ? currentUser.avatarUrl : otherAvatar,
        participant2Avatar: isCurrentFirst ? otherAvatar : currentUser.avatarUrl,
        lastMessageText: 'Conversation started',
        lastMessageSenderId: currentUser.uid,
        lastMessageStatus: 'sent',
        unreadCount1: 0,
        unreadCount2: 0,
        typingUid: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setChats((prev) => [newChat, ...prev]);
    }
    setActiveChatId(chatId);
    setActiveTab('chats');
  };

  const handleBlockUser = (targetUser: UserPublicProfile, reason: string) => {
    const blockId = `${currentUser.uid}_${targetUser.uid}`;
    if (blocks.some((b) => b.blockId === blockId)) return;

    const newBlock: UserBlock = {
      blockId,
      blockerUid: currentUser.uid,
      blockedUid: targetUser.uid,
      blockedUsername: targetUser.username,
      blockedDisplayName: targetUser.displayName,
      reason,
      createdAt: new Date().toISOString(),
    };

    setBlocks((prev) => [newBlock, ...prev]);
    setFriendships((prev) =>
      prev.filter((f) => f.user1Uid !== targetUser.uid && f.user2Uid !== targetUser.uid)
    );
    setFriendRequests((prev) =>
      prev.filter((r) => r.fromUid !== targetUser.uid && r.toUid !== targetUser.uid)
    );
    if (activeChatId && activeChatId.includes(targetUser.uid)) {
      setActiveChatId(null);
    }
    showToast(`Blocked @${targetUser.username}. They can no longer message or request you.`);
  };

  const handleUnblockUser = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
    showToast('User unblocked.');
  };

  const handleCreateStory = (input: {
    mediaType: 'text' | 'image';
    caption: string;
    mediaUrl: string;
    backgroundStyle: string;
    audience: StoryAudience;
  }) => {
    const now = Date.now();
    const newStory: StoryItem = {
      storyId: `story_${now}`,
      authorUid: currentUser.uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatarUrl: currentUser.avatarUrl,
      mediaType: input.mediaType,
      caption: input.caption,
      mediaUrl: input.mediaUrl,
      backgroundStyle: input.backgroundStyle,
      audience: input.audience,
      viewersCount: 0,
      viewers: [],
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 3600_000).toISOString(),
    };
    setStories((prev) => [newStory, ...prev]);
    showToast('Story published! Visible for 24 hours.');
  };

  const handleDeleteStory = (storyId: string) => {
    setStories((prev) =>
      prev.filter((s) => !(s.storyId === storyId && s.authorUid === currentUser.uid))
    );
    showToast('Story deleted.');
  };

  const handleRecordStoryView = (storyId: string) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.storyId !== storyId || s.authorUid === currentUser.uid) return s;
        const alreadyViewed = s.viewers?.some((v) => v.viewerUid === currentUser.uid);
        if (alreadyViewed) return s;
        const newViewer = {
          viewerUid: currentUser.uid,
          storyAuthorUid: s.authorUid,
          viewerUsername: currentUser.username,
          viewerDisplayName: currentUser.displayName,
          viewedAt: new Date().toISOString(),
        };
        return {
          ...s,
          viewersCount: s.viewersCount + 1,
          viewers: [...(s.viewers || []), newViewer],
        };
      })
    );
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalTarget || !reportDetails.trim()) return;

    const newReport: AbuseReport = {
      reportId: `report_${Date.now()}`,
      reporterUid: currentUser.uid,
      targetUid: reportModalTarget.targetUid,
      targetLabel: reportModalTarget.targetLabel,
      targetType: reportModalTarget.targetType,
      reasonCategory: reportCategory,
      details: reportDetails.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setReports((prev) => [newReport, ...prev]);
    setReportModalTarget(null);
    setReportDetails('');
    showToast('Safety report submitted for moderation review.');
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      await firebaseSignOut(auth).catch(() => {});
    }
    setSandboxAuthenticated(false);
  };

  const handleDeleteAccount = async () => {
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'users', firebaseUser.uid)).catch(() => {});
        await deleteDoc(doc(db, 'users_private', firebaseUser.uid)).catch(() => {});
        await deleteUser(firebaseUser).catch(() => {});
      } catch {
        // Handled
      }
    }
    setSandboxAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onEnterSandbox={handleEnterSandbox}
        existingUsernames={existingUsernames}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col pb-16 lg:pb-0 transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar Contract: Zone 1 Brand, Zone 2 5 Nav Links, Zone 3 Primary Action */}
      <header
        className={`flex items-center justify-between gap-8 px-4 sm:px-6 h-13 border-b sticky top-0 z-30 backdrop-blur-md ${
          darkMode
            ? 'border-slate-800 bg-slate-950/90'
            : 'border-slate-200 bg-white/90'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('chats');
          }}
          className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0"
        >
          ConnectX
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chats'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Chats {unreadChatsCount > 0 ? `(${unreadChatsCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'friends'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Friends {pendingIncomingRequestsCount > 0 ? `(${pendingIncomingRequestsCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'discover'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stories')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'stories'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Stories
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'profile'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Profile
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowNotificationsDrawer(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              Alerts {unreadNotificationsCount > 0 ? `(${unreadNotificationsCount})` : ''}
            </span>
          </button>
        </div>
      </header>

      {/* Toast Feedback Banner */}
      {toastBanner && (
        <div
          role="status"
          className="fixed bottom-18 lg:bottom-6 right-4 z-40 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold shadow-lg flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {activeTab === 'chats' && (
          <ChatsView
            currentUser={currentUser}
            chats={chats}
            messagesByChat={messagesByChat}
            activeChatId={activeChatId}
            blockedUids={blockedUids}
            directoryUsers={directoryUsers}
            onSelectChat={handleSelectChat}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onBlockUser={handleBlockUser}
            onReportTarget={(targetUid, targetLabel, targetType) =>
              setReportModalTarget({ targetUid, targetLabel, targetType })
            }
            onNavigateToFriends={() => setActiveTab('friends')}
          />
        )}

        {activeTab === 'friends' && (
          <FriendsView
            currentUser={currentUser}
            friendships={friendships}
            friendRequests={friendRequests}
            blocks={blocks}
            onAcceptRequest={handleAcceptFriendRequest}
            onRejectRequest={handleRejectFriendRequest}
            onCancelRequest={handleCancelFriendRequest}
            onRemoveFriend={handleRemoveFriend}
            onStartChatWithFriend={handleStartChatWithUser}
            onUnblockUser={handleUnblockUser}
            onNavigateToDiscover={() => setActiveTab('discover')}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverView
            currentUser={currentUser}
            directoryUsers={directoryUsers}
            friendships={friendships}
            friendRequests={friendRequests}
            blocks={blocks}
            onSendFriendRequest={handleSendFriendRequest}
            onCancelFriendRequest={handleCancelFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onStartChat={handleStartChatWithUser}
            onBlockUser={handleBlockUser}
            onReportTarget={(targetUid, targetLabel, targetType) =>
              setReportModalTarget({ targetUid, targetLabel, targetType })
            }
          />
        )}

        {activeTab === 'stories' && (
          <StoriesView
            currentUser={currentUser}
            stories={stories}
            friendUids={friendUids}
            blockedUids={blockedUids}
            onCreateStory={handleCreateStory}
            onDeleteStory={handleDeleteStory}
            onRecordStoryView={handleRecordStoryView}
            onReportTarget={(targetUid, targetLabel, targetType) =>
              setReportModalTarget({ targetUid, targetLabel, targetType })
            }
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            privateSettings={privateSettings}
            acceptedFriendsCount={friendships.length}
            reports={reports}
            isFirebaseAuthenticated={Boolean(firebaseUser)}
            emailVerified={Boolean(firebaseUser?.emailVerified)}
            onUpdateProfile={(updated) =>
              setCurrentUser((prev) => ({ ...prev, ...updated }))
            }
            onUpdatePrivateSettings={(updated) =>
              setPrivateSettings((prev) => ({ ...prev, ...updated }))
            }
            onRequestEmailVerification={() => {
              if (firebaseUser) {
                sendEmailVerification(firebaseUser).catch(() => {});
              }
            }}
            onRequestPasswordReset={() => {
              if (privateSettings.email) {
                sendPasswordResetEmail(auth, privateSettings.email).catch(() => {});
              }
            }}
            onDeleteAccount={handleDeleteAccount}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (5 Tabs: Chats, Friends, Discover, Stories, Profile) */}
      <nav
        aria-label="Bottom Navigation"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 border-t grid grid-cols-5 items-center backdrop-blur-md ${
          darkMode
            ? 'bg-slate-950/90 border-slate-800'
            : 'bg-white/90 border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeTab === 'chats'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">
            Chats {unreadChatsCount > 0 ? `(${unreadChatsCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeTab === 'friends'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">
            Friends {pendingIncomingRequestsCount > 0 ? `(${pendingIncomingRequestsCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeTab === 'discover'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Discover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stories')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeTab === 'stories'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Stories</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeTab === 'profile'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Profile</span>
        </button>
      </nav>

      {/* Notifications & Theme Drawer */}
      {showNotificationsDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-drawer-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
        >
          <div className="max-w-md w-full h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 id="notifications-drawer-title" className="text-base font-bold">
                  Notifications & Appearance
                </h2>
                <button
                  type="button"
                  aria-label="Close notifications drawer"
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Appearance & Lock-Screen Preview Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
                <span className="text-xs font-semibold">Theme Mode</span>
                <button
                  type="button"
                  onClick={() => setDarkMode((d) => !d)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{darkMode ? 'Switch to Light' : 'Switch to Dark'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  Recent Activity ({notifications.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                  }
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.notificationId}
                    className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      n.isRead
                        ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500'
                        : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{n.actorName}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        @{n.actorUsername}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {formatNotificationPreview(
                        n,
                        privateSettings.notificationPreviewEnabled
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNotificationsDrawer(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* Report Abuse Modal */}
      {reportModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Flag className="w-4 h-4" />
                <h3 id="report-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Submit Safety Report
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close report modal"
                onClick={() => setReportModalTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Reporting <span className="font-semibold">{reportModalTarget.targetLabel}</span> (
              {reportModalTarget.targetType}). Reports are write-only and cannot be modified after
              submission.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div>
                <label
                  htmlFor="report-category"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Reason Category
                </label>
                <select
                  id="report-category"
                  value={reportCategory}
                  onChange={(e) =>
                    setReportCategory(e.target.value as AbuseReport['reasonCategory'])
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="harassment">Harassment or abusive behavior</option>
                  <option value="spam">Spam or unsolicited links</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="other">Other safety concern</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-details"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Details (1–500 characters)
                </label>
                <textarea
                  id="report-details"
                  rows={3}
                  required
                  maxLength={500}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide context for the safety review team..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
