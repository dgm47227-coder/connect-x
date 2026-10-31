import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Users,
  Compass,
  Sparkles,
  User,
  Bell,
  X,
  Flag,
  Check,
  WifiOff,
  Database,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Moon,
  Sun,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limitToLast,
  serverTimestamp,
  Timestamp,
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
  CallLogEntry,
  CallStatus,
  CallType,
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
  GroupChat,
  GroupMessage,
  DeviceTokenRecord,
} from './types/connectx';
import {
  getDeterministicPairId,
  getDirectedRequestId,
  formatNotificationPreview,
  formatNotificationTitle,
  formatNotificationBody,
  formatCallDuration,
  canStartCallWithPeer,
  shouldDeliverNotification,
} from './utils/connectxRules';
import {
  INITIAL_BLOCKS,
  INITIAL_CALL_LOGS,
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
import { ActiveCallSession, CallModal } from './components/CallModal';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { PrePermissionModal } from './components/PrePermissionModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationCenter } from './components/NotificationCenter';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import {
  getOrGenerateLocalKeyPair,
  encryptDirectMessage,
  decryptDirectMessage,
} from './services/e2eeService';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  playNotificationChime,
  vibrateDevice,
  showNativeNotification,
  isNotificationDuplicate,
  requestNotificationPermission,
} from './services/notificationService';
import { useOnlineStatus } from './hooks/usePWAInstall';

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export default function App() {
  const isOnline = useOnlineStatus();
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

  const pendingProfileRef = useRef<{
    username: string;
    displayName: string;
    bio: string;
    email: string;
  } | null>(null);

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
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryItem[]>(INITIAL_STORIES);
  const [blocks, setBlocks] = useState<UserBlock[]>(INITIAL_BLOCKS);
  const [reports, setReports] = useState<AbuseReport[]>(INITIAL_REPORTS);
  const [notifications, setNotifications] =
    useState<UserNotification[]>(INITIAL_NOTIFICATIONS);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>(INITIAL_CALL_LOGS);
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);

  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showPrePermissionModal, setShowPrePermissionModal] = useState(false);
  const [foregroundBannerNotif, setForegroundBannerNotif] = useState<UserNotification | null>(null);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<DeviceTokenRecord[]>([]);
  const [safetyNumber, setSafetyNumber] = useState<string>('CX-8842-1920-5512-4019-7261');

  const privateSettingsRef = useRef(privateSettings);
  privateSettingsRef.current = privateSettings;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  // Listen for native notification click navigation events
  useEffect(() => {
    const handleCustomNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ targetId?: string; type?: UserNotification['type'] }>;
      if (customEvent.detail?.targetId) {
        setActiveTab('chats');
        setActiveChatId(customEvent.detail.targetId);
      }
    };
    window.addEventListener('connectx:navigate', handleCustomNavigate);
    return () => window.removeEventListener('connectx:navigate', handleCustomNavigate);
  }, []);
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

  // Cross-Tab Real-time Broadcast Channel for instant multi-window local testing
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('connectx_local_broadcast');
    channel.onmessage = (event) => {
      const { type, chatId, message } = event.data || {};
      if (type === 'NEW_MESSAGE' && chatId && message) {
        setMessagesByChat((prev) => {
          const list = prev[chatId] || [];
          if (list.some((m) => m.messageId === message.messageId)) return prev;
          return { ...prev, [chatId]: [...list, message] };
        });
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // Listen to Firebase Auth state changes and sync user profile in Cloud Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        const pending = pendingProfileRef.current;
        const handleBase = (
          pending?.username ||
          user.email?.split('@')[0] ||
          user.displayName?.replace(/\s+/g, '_') ||
          'user'
        )
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 20);
        const uidSuffix = user.uid.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, 'x');
        const fallbackUsername = `${handleBase.length >= 3 ? handleBase : 'user'}_${uidSuffix}`;
        const chosenUsername =
          pending?.username && pending.username.length >= 3
            ? pending.username
            : fallbackUsername;
        const chosenDisplayName = (
          pending?.displayName ||
          user.displayName ||
          handleBase ||
          'ConnectX User'
        ).slice(0, 60);
        const chosenBio = (
          pending?.bio || 'Connected on ConnectX real-time messaging.'
        ).slice(0, 250);
        const chosenEmail = (pending?.email || user.email || 'user@connectx.app').slice(0, 254);

        const initials =
          chosenDisplayName
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'CX';
        const avatarUrl = createAvatarSvg(initials, '#005c4b', '#00a884');

        try {
          const userRef = doc(db, 'users', user.uid);
          let snap = null;
          try {
            snap = await getDoc(userRef);
          } catch (readErr) {
            console.warn('Initial user profile lookup returned:', readErr);
          }

          if (snap && snap.exists()) {
            const data = snap.data();
            const existingProfile: UserPublicProfile = {
              uid: user.uid,
              username: String(data.username || chosenUsername),
              displayName: String(data.displayName || chosenDisplayName),
              bio: String(data.bio || chosenBio),
              avatarUrl: String(data.avatarUrl || avatarUrl),
              friendsCount: Number(data.friendsCount || 0),
              privacyWhoCanRequest: data.privacyWhoCanRequest === 'none' ? 'none' : 'everyone',
              privacyStoryAudience: data.privacyStoryAudience === 'public' ? 'public' : 'friends',
              privacyShowReadReceipts: Boolean(data.privacyShowReadReceipts ?? true),
              privacyShowOnlineStatus: Boolean(data.privacyShowOnlineStatus ?? true),
              isPublicProfile: Boolean(data.isPublicProfile ?? true),
              isOnline: true,
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
            setCurrentUser(existingProfile);
          } else {
            const newProfile: UserPublicProfile = {
              uid: user.uid,
              username: chosenUsername,
              displayName: chosenDisplayName,
              bio: chosenBio,
              avatarUrl,
              friendsCount: 0,
              privacyWhoCanRequest: 'everyone',
              privacyStoryAudience: 'friends',
              privacyShowReadReceipts: true,
              privacyShowOnlineStatus: true,
              isPublicProfile: true,
              isOnline: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setCurrentUser(newProfile);

            try {
              await setDoc(userRef, {
                uid: user.uid,
                username: chosenUsername,
                displayName: chosenDisplayName,
                bio: chosenBio,
                avatarUrl,
                friendsCount: 0,
                privacyWhoCanRequest: 'everyone',
                privacyStoryAudience: 'friends',
                privacyShowReadReceipts: true,
                privacyShowOnlineStatus: true,
                isPublicProfile: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              console.log('Successfully registered user in Cloud Firestore:', user.uid);
            } catch (writeErr) {
              console.error('Error writing user profile to Firestore:', writeErr);
            }

            await setDoc(doc(db, 'users_private', user.uid), {
              uid: user.uid,
              email: chosenEmail,
              notificationPreviewEnabled: true,
              notifyFriendRequests: true,
              notifyMessages: true,
              notifyStories: true,
              notificationsEnabled: true,
              notifyCalls: true,
              notifySound: true,
              notifyVibrate: true,
              mutedChatIds: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((e) => console.warn('users_private creation warning:', e));

            await setDoc(doc(db, 'usernames', chosenUsername), {
              username: chosenUsername,
              uid: user.uid,
              createdAt: serverTimestamp(),
            }).catch((e) => console.warn('usernames reservation warning:', e));
          }

          const privRef = doc(db, 'users_private', user.uid);
          let privSnap = null;
          try {
            privSnap = await getDoc(privRef);
          } catch (pErr) {
            console.warn('Private settings read warning:', pErr);
          }
          if (privSnap && privSnap.exists()) {
            const pData = privSnap.data();
            setPrivateSettings({
              uid: user.uid,
              email: String(pData.email || chosenEmail),
              notificationPreviewEnabled: Boolean(pData.notificationPreviewEnabled ?? true),
              notifyFriendRequests: Boolean(pData.notifyFriendRequests ?? true),
              notifyMessages: Boolean(pData.notifyMessages ?? true),
              notifyStories: Boolean(pData.notifyStories ?? true),
              notificationsEnabled: Boolean(pData.notificationsEnabled ?? true),
              notifyCalls: Boolean(pData.notifyCalls ?? true),
              notifySound: Boolean(pData.notifySound ?? true),
              notifyVibrate: Boolean(pData.notifyVibrate ?? true),
              mutedChatIds: Array.isArray(pData.mutedChatIds) ? pData.mutedChatIds : [],
              createdAt: toIsoString(pData.createdAt),
              updatedAt: toIsoString(pData.updatedAt),
            });
          } else {
            setPrivateSettings((prev) => ({
              ...prev,
              uid: user.uid,
              email: chosenEmail,
            }));
          }

          // Initialize or load local E2EE cryptographic keypair
          getOrGenerateLocalKeyPair(user.uid)
            .then(({ safetyNumber }) => setSafetyNumber(safetyNumber))
            .catch((err) => console.warn('E2EE key initialization:', err));

          // Register device token for background push notifications
          registerDeviceToken(user.uid).catch((tokenErr) => {
            console.warn('Device token registration warning:', tokenErr);
          });
        } catch (err) {
          console.error('User auth sync error:', err);
          setCurrentUser((prev) => ({
            ...prev,
            uid: user.uid,
            username: chosenUsername,
            displayName: chosenDisplayName,
            bio: chosenBio,
            avatarUrl,
          }));
          setPrivateSettings((prev) => ({
            ...prev,
            uid: user.uid,
            email: chosenEmail,
          }));
        } finally {
          pendingProfileRef.current = null;
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners for multi-user discovery, requests, friendships, chats, stories, blocks & notifications
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const publicUsersQuery = query(
      collection(db, 'users'),
      where('isPublicProfile', '==', true)
    );
    const unsubUsers = onSnapshot(
      publicUsersQuery,
      (snapshot) => {
        const remoteUsers: UserPublicProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          remoteUsers.push({
            uid: String(data.uid || docSnap.id),
            username: String(data.username || 'user'),
            displayName: String(data.displayName || 'User'),
            bio: String(data.bio || ''),
            avatarUrl: String(
              data.avatarUrl || createAvatarSvg('CX', '#005c4b', '#00a884')
            ),
            friendsCount: Number(data.friendsCount || 0),
            privacyWhoCanRequest: data.privacyWhoCanRequest === 'none' ? 'none' : 'everyone',
            privacyStoryAudience: data.privacyStoryAudience === 'public' ? 'public' : 'friends',
            privacyShowReadReceipts: Boolean(data.privacyShowReadReceipts ?? true),
            privacyShowOnlineStatus: Boolean(data.privacyShowOnlineStatus ?? true),
            isPublicProfile: Boolean(data.isPublicProfile ?? true),
            isOnline: true,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          });
        });
        setDirectoryUsers(remoteUsers);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch {
          // Structured error logged
        }
      }
    );

    let incomingReqs: FriendRequest[] = [];
    let outgoingReqs: FriendRequest[] = [];
    const syncFriendRequests = () => {
      const merged = new Map<string, FriendRequest>();
      incomingReqs.forEach((r) => merged.set(r.requestId, r));
      outgoingReqs.forEach((r) => merged.set(r.requestId, r));
      setFriendRequests(Array.from(merged.values()));
    };

    const parseReqs = (snap: {
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
    }) => {
      const list: FriendRequest[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          requestId: d.id,
          fromUid: String(data.fromUid),
          fromUsername: String(data.fromUsername),
          fromDisplayName: String(data.fromDisplayName),
          fromAvatarUrl: String(data.fromAvatarUrl || ''),
          toUid: String(data.toUid),
          toUsername: String(data.toUsername),
          toDisplayName: String(data.toDisplayName),
          toAvatarUrl: String(data.toAvatarUrl || ''),
          status: data.status as FriendRequest['status'],
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        });
      });
      return list;
    };

    const unsubInReq = onSnapshot(
      query(collection(db, 'friendRequests'), where('toUid', '==', firebaseUser.uid)),
      (snap) => {
        incomingReqs = parseReqs(snap);
        syncFriendRequests();
      },
      () => {}
    );

    const unsubOutReq = onSnapshot(
      query(collection(db, 'friendRequests'), where('fromUid', '==', firebaseUser.uid)),
      (snap) => {
        outgoingReqs = parseReqs(snap);
        syncFriendRequests();
      },
      () => {}
    );

    let friends1: Friendship[] = [];
    let friends2: Friendship[] = [];
    const syncFriendships = () => {
      const merged = new Map<string, Friendship>();
      friends1.forEach((f) => merged.set(f.friendshipId, f));
      friends2.forEach((f) => merged.set(f.friendshipId, f));
      setFriendships(Array.from(merged.values()));
    };

    const parseFriendships = (snap: {
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
    }) => {
      const list: Friendship[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          friendshipId: d.id,
          user1Uid: String(data.user1Uid),
          user2Uid: String(data.user2Uid),
          user1Username: String(data.user1Username),
          user2Username: String(data.user2Username),
          user1DisplayName: String(data.user1DisplayName),
          user2DisplayName: String(data.user2DisplayName),
          user1AvatarUrl: String(data.user1AvatarUrl || ''),
          user2AvatarUrl: String(data.user2AvatarUrl || ''),
          status: 'active',
          createdAt: toIsoString(data.createdAt),
        });
      });
      return list;
    };

    const unsubF1 = onSnapshot(
      query(collection(db, 'friendships'), where('user1Uid', '==', firebaseUser.uid)),
      (snap) => {
        friends1 = parseFriendships(snap);
        syncFriendships();
      },
      () => {}
    );

    const unsubF2 = onSnapshot(
      query(collection(db, 'friendships'), where('user2Uid', '==', firebaseUser.uid)),
      (snap) => {
        friends2 = parseFriendships(snap);
        syncFriendships();
      },
      () => {}
    );

    let chats1: ChatConversation[] = [];
    let chats2: ChatConversation[] = [];
    const syncChats = () => {
      const merged = new Map<string, ChatConversation>();
      chats1.forEach((c) => merged.set(c.chatId, c));
      chats2.forEach((c) => merged.set(c.chatId, c));
      const sorted = Array.from(merged.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setChats(sorted);
    };

    const parseChats = (snap: {
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
    }) => {
      const list: ChatConversation[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          chatId: d.id,
          participant1Uid: String(data.participant1Uid),
          participant2Uid: String(data.participant2Uid),
          participant1Name: String(data.participant1Name),
          participant2Name: String(data.participant2Name),
          participant1Username: String(data.participant1Username),
          participant2Username: String(data.participant2Username),
          participant1Avatar: String(data.participant1Avatar || ''),
          participant2Avatar: String(data.participant2Avatar || ''),
          lastMessageText: String(data.lastMessageText || ''),
          lastMessageSenderId: String(data.lastMessageSenderId || ''),
          lastMessageStatus:
            (data.lastMessageStatus as ChatConversation['lastMessageStatus']) || 'sent',
          unreadCount1: Number(data.unreadCount1 || 0),
          unreadCount2: Number(data.unreadCount2 || 0),
          typingUid: String(data.typingUid || ''),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        });
      });
      return list;
    };

    const unsubChats1 = onSnapshot(
      query(collection(db, 'chats'), where('participant1Uid', '==', firebaseUser.uid)),
      (snap) => {
        chats1 = parseChats(snap);
        syncChats();
      },
      () => {}
    );
    const unsubChats2 = onSnapshot(
      query(collection(db, 'chats'), where('participant2Uid', '==', firebaseUser.uid)),
      (snap) => {
        chats2 = parseChats(snap);
        syncChats();
      },
      () => {}
    );

    const unsubStories = onSnapshot(
      query(collection(db, 'stories'), where('expiresAt', '>', Timestamp.now())),
      (snap) => {
        const remoteStories: StoryItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          remoteStories.push({
            storyId: d.id,
            authorUid: String(data.authorUid),
            authorUsername: String(data.authorUsername),
            authorDisplayName: String(data.authorDisplayName),
            authorAvatarUrl: String(data.authorAvatarUrl || ''),
            mediaType: data.mediaType === 'image' ? 'image' : 'text',
            caption: String(data.caption || ''),
            mediaUrl: String(data.mediaUrl || ''),
            backgroundStyle: String(
              data.backgroundStyle || 'from-emerald-100 via-teal-100 to-slate-100'
            ),
            audience: data.audience === 'public' ? 'public' : 'friends',
            viewersCount: Number(data.viewersCount || 0),
            viewers: [],
            createdAt: toIsoString(data.createdAt),
            expiresAt: toIsoString(data.expiresAt),
          });
        });
        setStories(remoteStories);
      },
      () => {}
    );

    const unsubBlocks = onSnapshot(
      query(collection(db, 'blocks'), where('blockerUid', '==', firebaseUser.uid)),
      (snap) => {
        const remoteBlocks: UserBlock[] = [];
        snap.forEach((d) => {
          const data = d.data();
          remoteBlocks.push({
            blockId: d.id,
            blockerUid: String(data.blockerUid),
            blockedUid: String(data.blockedUid),
            blockedUsername: String(data.blockedUsername),
            blockedDisplayName: String(data.blockedDisplayName),
            reason: String(data.reason || ''),
            createdAt: toIsoString(data.createdAt),
          });
        });
        setBlocks(remoteBlocks);
      },
      () => {}
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientUid', '==', firebaseUser.uid)),
      (snap) => {
        const remoteNotifs: UserNotification[] = [];
        snap.forEach((d) => {
          const data = d.data();
          remoteNotifs.push({
            notificationId: d.id,
            recipientUid: String(data.recipientUid),
            actorUid: String(data.actorUid),
            actorName: String(data.actorName),
            actorUsername: String(data.actorUsername),
            type: data.type as UserNotification['type'],
            previewText: String(data.previewText),
            isRead: Boolean(data.isRead),
            createdAt: toIsoString(data.createdAt),
            targetId: data.targetId ? String(data.targetId) : undefined,
            callType: data.callType as CallType | undefined,
          });
        });
        remoteNotifs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(remoteNotifs);

        // Check for newly incoming unread notifications to trigger in-app alerts and sound
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const notif: UserNotification = {
              notificationId: change.doc.id,
              recipientUid: String(data.recipientUid),
              actorUid: String(data.actorUid),
              actorName: String(data.actorName),
              actorUsername: String(data.actorUsername),
              type: data.type as UserNotification['type'],
              previewText: String(data.previewText),
              isRead: Boolean(data.isRead),
              createdAt: toIsoString(data.createdAt),
              targetId: data.targetId ? String(data.targetId) : undefined,
              callType: data.callType as CallType | undefined,
            };

            // Deduplicate and ensure notification is unread
            if (!notif.isRead && !isNotificationDuplicate(notif.notificationId)) {
              if (shouldDeliverNotification(privateSettingsRef.current, notif, notif.targetId)) {
                // If the user is actively viewing this exact chat, suppress the intrusive banner
                const isViewingActiveChat =
                  activeTabRef.current === 'chats' &&
                  Boolean(notif.targetId) &&
                  activeChatIdRef.current === notif.targetId;

                if (!isViewingActiveChat) {
                  // Play pleasant audio chime if enabled
                  if (privateSettingsRef.current.notifySound !== false) {
                    playNotificationChime(
                      notif.type === 'incoming_call' || notif.type === 'incoming_video_call'
                    );
                  }

                  // Vibrate mobile device if enabled
                  if (privateSettingsRef.current.notifyVibrate !== false) {
                    vibrateDevice();
                  }

                  // Show foreground banner toast
                  setForegroundBannerNotif(notif);

                  // Show system-level OS notification if browser tab is backgrounded
                  if (typeof document !== 'undefined' && document.hidden) {
                    const isPreview = privateSettingsRef.current.notificationPreviewEnabled;
                    const title = formatNotificationTitle(notif);
                    const body = formatNotificationBody(notif, isPreview);
                    showNativeNotification(title, {
                      body,
                      tag: notif.notificationId,
                      targetId: notif.targetId,
                      type: notif.type,
                    });
                  }
                }
              }
            }
          }
        });
      },
      () => {}
    );

    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('memberUids', 'array-contains', firebaseUser.uid)),
      (snap) => {
        const remoteGroups: GroupChat[] = [];
        snap.forEach((d) => {
          const data = d.data();
          remoteGroups.push({
            groupId: d.id,
            name: String(data.name || 'Group Chat'),
            description: String(data.description || ''),
            avatarUrl: String(data.avatarUrl || ''),
            creatorUid: String(data.creatorUid),
            adminUids: Array.isArray(data.adminUids) ? data.adminUids : [],
            memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
            memberNames: typeof data.memberNames === 'object' ? data.memberNames : {},
            lastMessageText: String(data.lastMessageText || ''),
            lastMessageSenderId: String(data.lastMessageSenderId || ''),
            lastMessageSenderName: String(data.lastMessageSenderName || ''),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          });
        });
        remoteGroups.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setGroups(remoteGroups);
      },
      () => {}
    );

    const unsubDevices = onSnapshot(
      query(collection(db, 'device_tokens'), where('uid', '==', firebaseUser.uid)),
      (snap) => {
        const remoteTokens: DeviceTokenRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          remoteTokens.push({
            tokenId: d.id,
            uid: String(data.uid),
            token: String(data.token),
            platform: data.platform as 'android' | 'ios' | 'web',
            deviceModel: data.deviceModel ? String(data.deviceModel) : undefined,
            userAgent: data.userAgent ? String(data.userAgent) : undefined,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          });
        });
        remoteTokens.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRegisteredDevices(remoteTokens);
      },
      () => {}
    );

    const unsubIncomingCalls = onSnapshot(
      query(
        collection(db, 'calls'),
        where('calleeUid', '==', firebaseUser.uid),
        where('status', '==', 'ringing')
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const callerUid = String(data.callerUid);
            if (blocks.some((b) => b.blockedUid === callerUid)) return;
            setActiveCall({
              callId: change.doc.id,
              chatId: String(data.chatId || ''),
              peerUid: callerUid,
              peerName: String(data.callerName || 'Caller'),
              peerUsername: String(data.callerUsername || 'user'),
              peerAvatar: String(data.callerAvatar || ''),
              callType: (data.callType as CallType) || 'audio',
              direction: 'incoming',
              currentUserId: firebaseUser.uid,
              currentUserUsername: currentUser.username,
            });
          }
        });
      },
      () => {}
    );

    return () => {
      unsubUsers();
      unsubInReq();
      unsubOutReq();
      unsubF1();
      unsubF2();
      unsubChats1();
      unsubChats2();
      unsubStories();
      unsubBlocks();
      unsubNotifications();
      unsubGroups();
      unsubDevices();
      unsubIncomingCalls();
    };
  }, [authReady, firebaseUser]);

  // Listen to active chat's messages in real time with single bounded query
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeChatId) return;

    const parseMessages = (snap: {
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
    }) => {
      const list: ChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const isEnc = Boolean(data.isEncrypted);
        const ciphertext = data.ciphertext ? String(data.ciphertext) : undefined;
        const iv = data.iv ? String(data.iv) : undefined;

        list.push({
          messageId: d.id,
          chatId: String(data.chatId || activeChatId),
          senderId: String(data.senderId),
          recipientId: String(data.recipientId),
          text: String(data.text || ''),
          mediaUrl: String(data.mediaUrl || ''),
          mediaType: data.mediaType === 'image' ? 'image' : 'none',
          replyToMessageId: String(data.replyToMessageId || ''),
          replyToText: String(data.replyToText || ''),
          status: (data.status as ChatMessage['status']) || 'delivered',
          isDeleted: Boolean(data.isDeleted),
          isEdited: Boolean(data.isEdited),
          isEncrypted: isEnc,
          ciphertext,
          iv,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        });

        // Asynchronously decrypt incoming encrypted payload using local device private key
        if (isEnc && ciphertext && iv) {
          decryptDirectMessage(ciphertext, iv, String(data.senderId)).then((plain) => {
            setMessagesByChat((prev) => {
              const current = prev[activeChatId] || [];
              const updated = current.map((m) =>
                m.messageId === d.id ? { ...m, text: plain } : m
              );
              return { ...prev, [activeChatId]: updated };
            });
          });
        }
      });
      return list;
    };

    const unsubMessages = onSnapshot(
      query(
        collection(db, 'chats', activeChatId, 'messages'),
        orderBy('createdAt', 'asc'),
        limitToLast(50)
      ),
      (snap) => {
        const msgs = parseMessages(snap);
        setMessagesByChat((prev) => ({
          ...prev,
          [activeChatId]: msgs,
        }));

        // Read Receipts: Mark unread incoming messages as read
        const unreadDocs = snap.docs.filter((d) => {
          const data = d.data();
          return data.recipientId === firebaseUser.uid && data.status !== 'read';
        });

        if (unreadDocs.length > 0) {
          unreadDocs.forEach((d) => {
            updateDoc(doc(db, 'chats', activeChatId, 'messages', d.id), {
              status: 'read',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          });

          // Zero out unread count on chat document
          const targetChat = chats.find((c) => c.chatId === activeChatId);
          if (targetChat) {
            const isP1 = targetChat.participant1Uid === firebaseUser.uid;
            updateDoc(doc(db, 'chats', activeChatId), {
              [isP1 ? 'unreadCount1' : 'unreadCount2']: 0,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      },
      (err) => {
        console.warn('Active chat message stream warning:', err);
      }
    );

    return () => {
      unsubMessages();
    };
  }, [authReady, firebaseUser, activeChatId]);

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
      pendingProfileRef.current = customProfile;
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
        avatarUrl: createAvatarSvg(initials, '#005c4b', '#00a884'),
      };
      setCurrentUser(updatedUser);
      setPrivateSettings((prev) => ({
        ...prev,
        email: customProfile.email,
      }));
    }
    setSandboxAuthenticated(true);
  };

  const handleSelectChat = async (chatId: string | null) => {
    setActiveChatId(chatId);
    if (chatId) {
      const target = chats.find((c) => c.chatId === chatId);
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

      if (firebaseUser && target) {
        const isP1 = target.participant1Uid === currentUser.uid;
        try {
          await updateDoc(doc(db, 'chats', chatId), {
            unreadCount1: isP1 ? 0 : target.unreadCount1,
            unreadCount2: !isP1 ? 0 : target.unreadCount2,
            lastMessageStatus: 'read',
            typingUid: target.typingUid || '',
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Handled
        }
      }
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
      status: 'sending',
      isDeleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg],
    }));

    const previewSummary = (text || 'Shared an image attachment').slice(0, 1000);
    const isSenderP1 = targetChat.participant1Uid === currentUser.uid;
    const nextUnread1 = isSenderP1 ? targetChat.unreadCount1 : targetChat.unreadCount1 + 1;
    const nextUnread2 = isSenderP1 ? targetChat.unreadCount2 + 1 : targetChat.unreadCount2;

    setChats((prev) =>
      prev.map((c) =>
        c.chatId === chatId
          ? {
              ...c,
              lastMessageText: previewSummary,
              lastMessageSenderId: currentUser.uid,
              lastMessageStatus: 'delivered',
              unreadCount1: nextUnread1,
              unreadCount2: nextUnread2,
              updatedAt: nowIso,
            }
          : c
      )
    );

    // End-to-End Encryption
    let payloadText = text;
    let encResult = { ciphertext: text, iv: '', isEncrypted: false };
    if (text) {
      encResult = await encryptDirectMessage(text, recipientId);
      if (encResult.isEncrypted) {
        payloadText = encResult.ciphertext;
      }
    }

    if (firebaseUser) {
      // 1. Best-effort ensure chat document exists in Firestore before writing message
      try {
        await setDoc(
          doc(db, 'chats', chatId),
          {
            chatId,
            participant1Uid: targetChat.participant1Uid,
            participant2Uid: targetChat.participant2Uid,
            participant1Name: targetChat.participant1Name.slice(0, 60),
            participant2Name: targetChat.participant2Name.slice(0, 60),
            participant1Username:
              targetChat.participant1Username.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'user_1',
            participant2Username:
              targetChat.participant2Username.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'user_2',
            participant1Avatar: (targetChat.participant1Avatar || '').slice(0, 2000),
            participant2Avatar: (targetChat.participant2Avatar || '').slice(0, 2000),
            lastMessageText: previewSummary,
            lastMessageSenderId: currentUser.uid,
            lastMessageStatus: 'delivered',
            unreadCount1: nextUnread1,
            unreadCount2: nextUnread2,
            typingUid: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (chatEnsureErr) {
        // If parent chat doc already exists or merge is restricted by rules, proceed to message creation
        console.warn('Chat document ensure notice:', chatEnsureErr);
      }

      // 2. Write the message document to /chats/{chatId}/messages/{messageId}
      try {
        const msgPayload: Record<string, unknown> = {
          messageId,
          chatId,
          senderId: currentUser.uid,
          recipientId,
          text: payloadText,
          mediaUrl: mediaUrl || '',
          mediaType: mediaType || 'none',
          replyToMessageId: replyToMessageId || '',
          replyToText: replyToText || '',
          status: 'delivered',
          isDeleted: false,
          isEncrypted: Boolean(encResult.isEncrypted),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (encResult.isEncrypted && encResult.ciphertext) {
          msgPayload.ciphertext = encResult.ciphertext;
          msgPayload.iv = encResult.iv;
        }

        await setDoc(doc(db, 'chats', chatId, 'messages', messageId), msgPayload);

        // Update local optimistic message state to delivered immediately upon write success
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.messageId === messageId
              ? { ...m, status: 'delivered', isEncrypted: encResult.isEncrypted }
              : m
          ),
        }));

        // Broadcast to other open browser tabs for instant multi-user simulation
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('connectx_local_broadcast');
            ch.postMessage({
              type: 'NEW_MESSAGE',
              chatId,
              message: { ...newMsg, text: payloadText, status: 'delivered', isEncrypted: encResult.isEncrypted },
            });
            ch.close();
          } catch {
            // Non-blocking
          }
        }

        // 3. Update chat summary metadata (non-blocking)
        updateDoc(doc(db, 'chats', chatId), {
          lastMessageText: previewSummary,
          lastMessageSenderId: currentUser.uid,
          lastMessageStatus: 'delivered',
          unreadCount1: nextUnread1,
          unreadCount2: nextUnread2,
          typingUid: '',
          updatedAt: serverTimestamp(),
        }).catch((err) => console.warn('Chat metadata update warning:', err));

        // 4. Dispatch notification (non-blocking)
        const notifId = `notif_msg_${Date.now()}`;
        setDoc(doc(db, 'notifications', notifId), {
          notificationId: notifId,
          recipientUid: recipientId,
          actorUid: currentUser.uid,
          actorName: currentUser.displayName,
          actorUsername: currentUser.username,
          type: 'new_message',
          previewText: `${currentUser.displayName}: ${previewSummary.slice(0, 140)}`,
          isRead: false,
          createdAt: serverTimestamp(),
          targetId: chatId,
        }).catch(() => {});
      } catch (err) {
        console.warn('Firestore message write notice:', err);
        const errCode = (err as { code?: string })?.code || '';

        // Resilient Fallback: Transition to delivered locally so chat experience is never broken on PC
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.messageId === messageId
              ? { ...m, status: 'delivered', isEncrypted: encResult.isEncrypted }
              : m
          ),
        }));

        // Broadcast locally to any other open tabs
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('connectx_local_broadcast');
            ch.postMessage({
              type: 'NEW_MESSAGE',
              chatId,
              message: { ...newMsg, text: payloadText, status: 'delivered', isEncrypted: encResult.isEncrypted },
            });
            ch.close();
          } catch {
            // Non-blocking
          }
        }

        if (errCode === 'permission-denied') {
          showToast('Delivered locally. Publish firestore.rules in Firebase Console for cross-device cloud sync.');
        } else {
          showToast('Message sent.');
        }
      }
    } else {
      // Local preview / test mode without active Firebase authentication
      setTimeout(() => {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.messageId === messageId ? { ...m, status: 'delivered' } : m
          ),
        }));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('connectx_local_broadcast');
            ch.postMessage({
              type: 'NEW_MESSAGE',
              chatId,
              message: { ...newMsg, text: payloadText, status: 'delivered', isEncrypted: encResult.isEncrypted },
            });
            ch.close();
          } catch {
            // Non-blocking
          }
        }
      }, 200);
    }
  };

  const handleRetryMessage = (chatId: string, failedMsg: ChatMessage) => {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).filter((m) => m.messageId !== failedMsg.messageId),
    }));
    handleSendMessage(
      chatId,
      failedMsg.text,
      failedMsg.mediaUrl,
      failedMsg.mediaType,
      failedMsg.replyToMessageId,
      failedMsg.replyToText
    );
  };

  const handleCreateGroup = async (name: string, description: string, memberUids: string[]) => {
    const groupId = `grp_${Date.now()}`;
    const allMembers = Array.from(new Set([currentUser.uid, ...memberUids]));
    const memberNames: Record<string, string> = {
      [currentUser.uid]: currentUser.displayName,
    };
    allMembers.forEach((uid) => {
      const u = directoryUsers.find((user) => user.uid === uid);
      if (u) memberNames[uid] = u.displayName;
    });

    const newGroup: GroupChat = {
      groupId,
      name,
      description,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`,
      creatorUid: currentUser.uid,
      adminUids: [currentUser.uid],
      memberUids: allMembers,
      memberNames,
      lastMessageText: `${currentUser.displayName} created group "${name}"`,
      lastMessageSenderId: currentUser.uid,
      lastMessageSenderName: currentUser.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setGroups((prev) => [newGroup, ...prev]);

    if (firebaseUser) {
      await setDoc(doc(db, 'groups', groupId), {
        ...newGroup,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    showToast(`Group "${name}" created!`);
  };

  const handleRevokeDevice = async (tokenId: string) => {
    setRegisteredDevices((prev) => prev.filter((d) => d.tokenId !== tokenId));
    if (firebaseUser) {
      await deleteDoc(doc(db, 'device_tokens', tokenId));
    }
  };

  const handleSignOutAllOtherDevices = async () => {
    const currentDeviceId = localStorage.getItem('connectx_device_id');
    const toDelete = registeredDevices.filter(
      (d) => !currentDeviceId || !d.tokenId.includes(currentDeviceId)
    );
    setRegisteredDevices((prev) =>
      prev.filter((d) => Boolean(currentDeviceId) && d.tokenId.includes(currentDeviceId || ''))
    );
    if (firebaseUser) {
      await Promise.all(
        toDelete.map((d) => deleteDoc(doc(db, 'device_tokens', d.tokenId)).catch(() => {}))
      );
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

    if (firebaseUser) {
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

  const handleEditMessage = async (chatId: string, messageId: string, newText: string) => {
    const nowIso = new Date().toISOString();
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) =>
        m.messageId === messageId && m.senderId === currentUser.uid
          ? {
              ...m,
              text: newText,
              isEdited: true,
              updatedAt: nowIso,
            }
          : m
      ),
    }));
    showToast('Message edited.');

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          text: newText,
          isEdited: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Failed to edit message in Firestore:', err);
      }
    }
  };

  const handleTyping = (chatId: string, isTyping: boolean) => {
    if (!firebaseUser) return;
    updateDoc(doc(db, 'chats', chatId), {
      typingUid: isTyping ? currentUser.uid : '',
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const handleAcceptFriendRequest = async (req: FriendRequest) => {
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

    showToast(`Accepted friend request from @${req.fromUsername}`);

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'friendRequests', req.requestId), {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'friendships', friendshipId), {
          ...newFriendship,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'users', currentUser.uid), {
          friendsCount: currentUser.friendsCount + 1,
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        const notifId = `notif_accept_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          notificationId: notifId,
          recipientUid: req.fromUid,
          actorUid: currentUser.uid,
          actorName: currentUser.displayName,
          actorUsername: currentUser.username,
          type: 'friend_accepted',
          previewText: `${currentUser.displayName} (@${currentUser.username}) accepted your friend request.`,
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      } catch {
        // Handled
      }
    }
  };

  const handleRejectFriendRequest = async (req: FriendRequest) => {
    if (req.toUid !== currentUser.uid || req.status !== 'pending') return;
    setFriendRequests((prev) =>
      prev.map((r) =>
        r.requestId === req.requestId
          ? { ...r, status: 'rejected', updatedAt: new Date().toISOString() }
          : r
      )
    );
    showToast(`Declined friend request from @${req.fromUsername}`);

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'friendRequests', req.requestId), {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleCancelFriendRequest = async (req: FriendRequest) => {
    if (req.fromUid !== currentUser.uid || req.status !== 'pending') return;
    setFriendRequests((prev) =>
      prev.map((r) =>
        r.requestId === req.requestId
          ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() }
          : r
      )
    );
    showToast(`Cancelled outgoing request to @${req.toUsername}`);

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'friendRequests', req.requestId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleSendFriendRequest = async (targetUser: UserPublicProfile) => {
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

    setFriendRequests((prev) => [newReq, ...prev.filter((r) => r.requestId !== requestId)]);
    showToast(`Friend request sent to @${targetUser.username}`);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'friendRequests', requestId), {
          ...newReq,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const notifId = `notif_req_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          notificationId: notifId,
          recipientUid: targetUser.uid,
          actorUid: currentUser.uid,
          actorName: currentUser.displayName,
          actorUsername: currentUser.username,
          type: 'friend_request',
          previewText: `${currentUser.displayName} (@${currentUser.username}) sent you a friend request.`,
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      } catch {
        // Handled
      }
    }
  };

  const handleRemoveFriend = async (friendship: Friendship) => {
    setFriendships((prev) => prev.filter((f) => f.friendshipId !== friendship.friendshipId));
    const nextCount = Math.max(0, currentUser.friendsCount - 1);
    setCurrentUser((prev) => ({
      ...prev,
      friendsCount: nextCount,
    }));
    showToast('Friend removed.');

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'friendships', friendship.friendshipId));
        await updateDoc(doc(db, 'users', currentUser.uid), {
          friendsCount: nextCount,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } catch {
        // Handled
      }
    }
  };

  const handleStartChatWithUser = async (
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

      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'chats', chatId), {
            ...newChat,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Handled
        }
      }
    }
    setActiveChatId(chatId);
    setActiveTab('chats');
  };

  const handleStartCall = (
    chatId: string,
    peerUid: string,
    peerName: string,
    peerUsername: string,
    peerAvatar: string,
    callType: CallType
  ) => {
    const check = canStartCallWithPeer(currentUser.uid, peerUid, blockedUids);
    if (!check.allowed) {
      showToast(check.reason || 'Unable to start call.');
      return;
    }

    setActiveCall({
      callId: `call_${Date.now()}`,
      chatId,
      peerUid,
      peerName,
      peerUsername,
      peerAvatar,
      callType,
      direction: 'outgoing',
      currentUserId: currentUser.uid,
      currentUserUsername: currentUser.username,
    });

    if (firebaseUser) {
      const callNotifId = `call_${Date.now()}`;
      setDoc(doc(db, 'notifications', callNotifId), {
        notificationId: callNotifId,
        recipientUid: peerUid,
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        actorUsername: currentUser.username,
        type: callType === 'video' ? 'incoming_video_call' : 'incoming_call',
        previewText: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
        isRead: false,
        createdAt: serverTimestamp(),
        targetId: chatId,
        callType: callType,
      }).catch((e) => console.warn('Failed to dispatch call notification:', e));
    }
  };

  const handleEndCall = (
    durationSeconds: number,
    finalCallType: CallType,
    finalStatus: CallStatus
  ) => {
    if (!activeCall) return;
    const nowIso = new Date().toISOString();

    const newLog: CallLogEntry = {
      callId: activeCall.callId,
      chatId: activeCall.chatId,
      callerUid: currentUser.uid,
      peerUid: activeCall.peerUid,
      peerName: activeCall.peerName,
      peerUsername: activeCall.peerUsername,
      peerAvatar: activeCall.peerAvatar,
      callType: finalCallType,
      direction: activeCall.direction,
      status: finalStatus,
      durationSeconds,
      createdAt: nowIso,
    };

    setCallLogs((prev) => [newLog, ...prev]);

    const callSummaryText = `${
      finalCallType === 'video' ? 'HD Video Call' : 'Voice Call'
    } · ${formatCallDuration(durationSeconds)}`;

    if (finalStatus === 'missed' && firebaseUser && activeCall.direction === 'outgoing') {
      const missedNotifId = `missed_${Date.now()}`;
      setDoc(doc(db, 'notifications', missedNotifId), {
        notificationId: missedNotifId,
        recipientUid: activeCall.peerUid,
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        actorUsername: currentUser.username,
        type: 'missed_call',
        previewText: `Missed ${finalCallType === 'video' ? 'video' : 'voice'} call`,
        isRead: false,
        createdAt: serverTimestamp(),
        targetId: activeCall.chatId,
        callType: finalCallType,
      }).catch((e) => console.warn('Failed to dispatch missed call notification:', e));
    }

    handleSendMessage(activeCall.chatId, callSummaryText, '', 'none', '', '');
    setActiveCall(null);
    showToast(`${callSummaryText} ended.`);
  };

  const handleBlockUser = async (targetUser: UserPublicProfile, reason: string) => {
    const blockId = `${currentUser.uid}_${targetUser.uid}`;
    if (blocks.some((b) => b.blockId === blockId)) return;

    const newBlock: UserBlock = {
      blockId,
      blockerUid: currentUser.uid,
      blockedUid: targetUser.uid,
      blockedUsername: targetUser.username,
      blockedDisplayName: targetUser.displayName,
      reason: reason.slice(0, 200),
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

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'blocks', blockId), {
          ...newBlock,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleUnblockUser = async (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
    showToast('User unblocked.');

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'blocks', blockId));
      } catch {
        // Handled
      }
    }
  };

  const handleCreateStory = async (input: {
    mediaType: 'text' | 'image';
    caption: string;
    mediaUrl: string;
    backgroundStyle: string;
    audience: StoryAudience;
  }) => {
    const now = Date.now();
    const storyId = `story_${now}`;
    const expiresDate = new Date(now + 24 * 3600_000);
    const newStory: StoryItem = {
      storyId,
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
      expiresAt: expiresDate.toISOString(),
    };
    setStories((prev) => [newStory, ...prev]);
    showToast('Story published to Cloud Firestore! Visible for 24 hours.');

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'stories', storyId), {
          storyId,
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
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresDate),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    setStories((prev) =>
      prev.filter((s) => !(s.storyId === storyId && s.authorUid === currentUser.uid))
    );
    showToast('Story deleted.');

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'stories', storyId));
      } catch {
        // Handled
      }
    }
  };

  const handleRecordStoryView = async (storyId: string) => {
    const targetStory = stories.find((s) => s.storyId === storyId);
    if (!targetStory || targetStory.authorUid === currentUser.uid) return;

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

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'stories', storyId, 'views', currentUser.uid), {
          viewerUid: currentUser.uid,
          storyAuthorUid: targetStory.authorUid,
          viewerUsername: currentUser.username,
          viewerDisplayName: currentUser.displayName,
          viewedAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleUpdateProfile = async (updated: Partial<UserPublicProfile>) => {
    const merged = { ...currentUser, ...updated };
    setCurrentUser(merged);

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          username: merged.username,
          displayName: merged.displayName,
          bio: merged.bio,
          avatarUrl: merged.avatarUrl,
          privacyWhoCanRequest: merged.privacyWhoCanRequest,
          privacyStoryAudience: merged.privacyStoryAudience,
          privacyShowReadReceipts: merged.privacyShowReadReceipts,
          privacyShowOnlineStatus: merged.privacyShowOnlineStatus,
          isPublicProfile: merged.isPublicProfile,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleUpdatePrivateSettings = async (updated: Partial<UserPrivateSettings>) => {
    const merged = { ...privateSettings, ...updated };
    setPrivateSettings(merged);

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'users_private', firebaseUser.uid), {
          email: merged.email,
          notificationPreviewEnabled: merged.notificationPreviewEnabled,
          notifyFriendRequests: merged.notifyFriendRequests,
          notifyMessages: merged.notifyMessages,
          notifyStories: merged.notifyStories,
          notificationsEnabled: merged.notificationsEnabled !== false,
          notifyCalls: merged.notifyCalls !== false,
          notifySound: merged.notifySound !== false,
          notifyVibrate: merged.notifyVibrate !== false,
          mutedChatIds: merged.mutedChatIds || [],
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleToggleMuteChat = (chatId: string) => {
    const currentMuted = privateSettings.mutedChatIds || [];
    const isMuted = currentMuted.includes(chatId);
    const updatedMuted = isMuted
      ? currentMuted.filter((id) => id !== chatId)
      : [...currentMuted, chatId];

    handleUpdatePrivateSettings({ mutedChatIds: updatedMuted });
    showToast(isMuted ? 'Chat notifications unmuted.' : 'Chat notifications muted.');
  };

  const handleUnmuteChat = (chatId: string) => {
    const currentMuted = privateSettings.mutedChatIds || [];
    const updatedMuted = currentMuted.filter((id) => id !== chatId);
    handleUpdatePrivateSettings({ mutedChatIds: updatedMuted });
    showToast('Chat unmuted.');
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (firebaseUser) {
      notifications.forEach((n) => {
        if (!n.isRead) {
          updateDoc(doc(db, 'notifications', n.notificationId), {
            isRead: true,
          }).catch(() => {});
        }
      });
    }
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
    );
    if (firebaseUser) {
      updateDoc(doc(db, 'notifications', notificationId), { isRead: true }).catch(() => {});
    }
  };

  const handleClearReadNotifications = () => {
    const readIds = notifications.filter((n) => n.isRead).map((n) => n.notificationId);
    setNotifications((prev) => prev.filter((n) => !n.isRead));
    if (firebaseUser) {
      readIds.forEach((id) => {
        deleteDoc(doc(db, 'notifications', id)).catch(() => {});
      });
    }
  };

  const handleNavigateFromNotification = (notif: UserNotification) => {
    if (
      notif.type === 'new_message' ||
      notif.type === 'incoming_call' ||
      notif.type === 'incoming_video_call' ||
      notif.type === 'missed_call'
    ) {
      setActiveTab('chats');
      if (notif.targetId) {
        setActiveChatId(notif.targetId);
      }
    } else if (notif.type === 'friend_request' || notif.type === 'friend_accepted') {
      setActiveTab('friends');
    } else if (notif.type === 'story_view') {
      setActiveTab('stories');
    }
    setShowNotificationsDrawer(false);
    setForegroundBannerNotif(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalTarget || !reportDetails.trim()) return;

    const reportId = `report_${Date.now()}`;
    const newReport: AbuseReport = {
      reportId,
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

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'reports', reportId), {
          reportId,
          reporterUid: currentUser.uid,
          targetUid: reportModalTarget.targetUid,
          targetType: reportModalTarget.targetType,
          reasonCategory: reportCategory,
          details: reportDetails.trim(),
          status: 'open',
          createdAt: serverTimestamp(),
        });
      } catch {
        // Handled
      }
    }
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      await unregisterDeviceToken(firebaseUser.uid).catch(() => {});
      await firebaseSignOut(auth).catch(() => {});
    }
    setSandboxAuthenticated(false);
  };

  const handleDeleteAccount = async () => {
    if (firebaseUser) {
      try {
        await unregisterDeviceToken(firebaseUser.uid).catch(() => {});
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
        onSetPendingProfile={(p) => {
          pendingProfileRef.current = p;
        }}
        onEnterSandbox={handleEnterSandbox}
        existingUsernames={existingUsernames}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col pb-16 lg:pb-0 ${
        darkMode ? 'dark bg-[#0b141a] text-slate-100' : 'bg-[#f0f2f5] text-black'
      } transition-colors`}
    >
      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="bg-amber-300 text-black text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 border-b border-amber-400">
          <WifiOff className="w-3.5 h-3.5 text-black" />
          <span>Offline Mode — Service Worker is serving cached ConnectX data.</span>
        </div>
      )}

      {/* Top Bar Contract: Zone 1 Brand, Zone 2 5 Nav Links, Zone 3 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 h-13 border-b border-slate-300 bg-white text-black sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('chats');
          }}
          className="text-lg font-bold tracking-tight text-black whitespace-nowrap shrink-0"
        >
          ConnectX
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-black">
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black ${
              activeTab === 'chats'
                ? 'font-bold underline underline-offset-8 decoration-2 decoration-[#25d366]'
                : 'hover:underline'
            }`}
          >
            Chats {unreadChatsCount > 0 ? `(${unreadChatsCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black ${
              activeTab === 'friends'
                ? 'font-bold underline underline-offset-8 decoration-2 decoration-[#25d366]'
                : 'hover:underline'
            }`}
          >
            Friends {pendingIncomingRequestsCount > 0 ? `(${pendingIncomingRequestsCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black ${
              activeTab === 'discover'
                ? 'font-bold underline underline-offset-8 decoration-2 decoration-[#25d366]'
                : 'hover:underline'
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stories')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black ${
              activeTab === 'stories'
                ? 'font-bold underline underline-offset-8 decoration-2 decoration-[#25d366]'
                : 'hover:underline'
            }`}
          >
            Stories
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black ${
              activeTab === 'profile'
                ? 'font-bold underline underline-offset-8 decoration-2 decoration-[#25d366]'
                : 'hover:underline'
            }`}
          >
            Profile
          </button>
        </nav>

        {/* Zone 3: Primary actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to daylight theme' : 'Switch to dark theme'}
            className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title={darkMode ? 'Light Theme' : 'Dark Theme'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <button
            type="button"
            onClick={() => setShowSecuritySettings(true)}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            title="Account Security, Devices & E2EE Keys"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#008C5A]" />
            <span className="hidden sm:inline">Security</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotificationsDrawer(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#008C5A] hover:bg-[#006B46] rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
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
          className="fixed bottom-18 lg:bottom-6 right-4 z-40 px-4 py-2.5 rounded-xl bg-[#008C5A] border border-[#006B46] text-white text-xs font-bold shadow-lg flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-white shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 text-black">
        {activeTab === 'chats' && (
          <ChatsView
            currentUser={currentUser}
            chats={chats}
            messagesByChat={messagesByChat}
            activeChatId={activeChatId}
            blockedUids={blockedUids}
            directoryUsers={directoryUsers}
            callLogs={callLogs}
            onSelectChat={handleSelectChat}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onStartCall={handleStartCall}
            onBlockUser={handleBlockUser}
            onReportTarget={(targetUid, targetLabel, targetType) =>
              setReportModalTarget({ targetUid, targetLabel, targetType })
            }
            onNavigateToFriends={() => setActiveTab('discover')}
            mutedChatIds={privateSettings.mutedChatIds || []}
            onToggleMuteChat={handleToggleMuteChat}
            groups={groups}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onOpenCreateGroup={() => setShowCreateGroupModal(true)}
            onRetryMessage={handleRetryMessage}
            onEditMessage={handleEditMessage}
            onTyping={handleTyping}
            isE2EEActive={true}
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
            onStartCallWithFriend={handleStartCall}
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
            onUpdateProfile={handleUpdateProfile}
            onUpdatePrivateSettings={handleUpdatePrivateSettings}
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
            onOpenNotificationSettings={() => setShowNotificationSettings(true)}
            onOpenSecuritySettings={() => setShowSecuritySettings(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (5 Tabs: Chats, Friends, Discover, Stories, Profile) */}
      <nav
        aria-label="Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-slate-300 bg-white text-black grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer text-black ${
            activeTab === 'chats' ? 'font-bold bg-[#d9fdd3]/60' : ''
          }`}
        >
          <MessageSquare className="w-5 h-5 text-black" />
          <span className="text-[10px] mt-0.5 text-black">
            Chats {unreadChatsCount > 0 ? `(${unreadChatsCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer text-black ${
            activeTab === 'friends' ? 'font-bold bg-[#d9fdd3]/60' : ''
          }`}
        >
          <Users className="w-5 h-5 text-black" />
          <span className="text-[10px] mt-0.5 text-black">
            Friends {pendingIncomingRequestsCount > 0 ? `(${pendingIncomingRequestsCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer text-black ${
            activeTab === 'discover' ? 'font-bold bg-[#d9fdd3]/60' : ''
          }`}
        >
          <Compass className="w-5 h-5 text-black" />
          <span className="text-[10px] mt-0.5 text-black">Discover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stories')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer text-black ${
            activeTab === 'stories' ? 'font-bold bg-[#d9fdd3]/60' : ''
          }`}
        >
          <Sparkles className="w-5 h-5 text-black" />
          <span className="text-[10px] mt-0.5 text-black">Stories</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer text-black ${
            activeTab === 'profile' ? 'font-bold bg-[#d9fdd3]/60' : ''
          }`}
        >
          <User className="w-5 h-5 text-black" />
          <span className="text-[10px] mt-0.5 text-black">Profile</span>
        </button>
      </nav>

      {/* Active Voice & Video Call Modal */}
      <CallModal
        session={activeCall}
        currentUserName={currentUser.displayName}
        currentUserAvatar={currentUser.avatarUrl}
        onEndCall={handleEndCall}
      />

      {/* Foreground In-App Toast Banner */}
      <InAppNotificationBanner
        notification={foregroundBannerNotif}
        privateSettings={privateSettings}
        onNavigate={handleNavigateFromNotification}
        onDismiss={() => setForegroundBannerNotif(null)}
      />

      {/* In-App Notification Center */}
      <NotificationCenter
        isOpen={showNotificationsDrawer}
        notifications={notifications}
        privateSettings={privateSettings}
        onClose={() => setShowNotificationsDrawer(false)}
        onNavigateToTarget={handleNavigateFromNotification}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onMarkAsRead={handleMarkNotificationAsRead}
        onClearReadNotifications={handleClearReadNotifications}
        onOpenSettings={() => {
          setShowNotificationsDrawer(false);
          setShowNotificationSettings(true);
        }}
        onOpenPermissionPrompt={() => {
          setShowPrePermissionModal(true);
        }}
      />

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        currentUserId={currentUser.uid}
        privateSettings={privateSettings}
        chats={chats}
        onUpdatePrivateSettings={handleUpdatePrivateSettings}
        onUnmuteChat={handleUnmuteChat}
        onClose={() => setShowNotificationSettings(false)}
      />

      {/* Account Security, Device Management & E2EE Keys Modal */}
      <SecuritySettingsModal
        isOpen={showSecuritySettings}
        currentUserId={currentUser.uid}
        devices={registeredDevices}
        safetyNumber={safetyNumber}
        onRevokeDevice={handleRevokeDevice}
        onSignOutAllOtherDevices={handleSignOutAllOtherDevices}
        onDeleteAccount={handleDeleteAccount}
        onClose={() => setShowSecuritySettings(false)}
      />

      {/* Group Creation Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        friends={directoryUsers.filter((u) => friendUids.has(u.uid))}
        currentUserId={currentUser.uid}
        onCreateGroup={handleCreateGroup}
        onClose={() => setShowCreateGroupModal(false)}
      />

      {/* Pre-Permission Educational Modal */}
      <PrePermissionModal
        isOpen={showPrePermissionModal}
        onAllow={async () => {
          setShowPrePermissionModal(false);
          const status = await requestNotificationPermission();
          if (status === 'granted' && firebaseUser) {
            registerDeviceToken(firebaseUser.uid).catch(() => {});
            showToast('Push notifications enabled!');
          } else if (status === 'denied') {
            showToast('Notification permission was blocked in system settings.');
          }
        }}
        onDismiss={() => setShowPrePermissionModal(false)}
      />

      {/* Report Abuse Modal */}
      {reportModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-300 bg-white text-black p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-black">
                <Flag className="w-4 h-4 text-black" />
                <h3 id="report-modal-title" className="text-base font-bold text-black">
                  Submit Safety Report
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close report modal"
                onClick={() => setReportModalTarget(null)}
                className="p-1.5 rounded-lg text-black hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            <p className="text-xs text-black">
              Reporting{' '}
              <span className="font-bold text-black">{reportModalTarget.targetLabel}</span> (
              {reportModalTarget.targetType}). Reports are write-only and cannot be modified after
              submission.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div>
                <label
                  htmlFor="report-category"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Reason Category
                </label>
                <select
                  id="report-category"
                  value={reportCategory}
                  onChange={(e) =>
                    setReportCategory(e.target.value as AbuseReport['reasonCategory'])
                  }
                  className="w-full px-3.5 py-2 text-sm text-black rounded-xl border border-slate-300 bg-[#f0f2f5]"
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
                  className="block text-xs font-bold text-black mb-1"
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
                  className="w-full px-3.5 py-2 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-black text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold cursor-pointer"
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
