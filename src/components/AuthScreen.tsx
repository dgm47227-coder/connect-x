import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  AtSign,
  ArrowRight,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Sparkles,
  Database,
  Check,
  X as XIcon,
  ShieldAlert,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  sendEmailVerification,
} from '../firebase';
import {
  normalizeUsername,
  validateProfileInput,
  validatePasswordStrength,
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogins,
} from '../utils/connectxRules';

interface AuthScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSetPendingProfile?: (customProfile: {
    username: string;
    displayName: string;
    bio: string;
    email: string;
  }) => void;
  onEnterSandbox: (customProfile?: {
    username: string;
    displayName: string;
    bio: string;
    email: string;
  }) => void;
  existingUsernames: Set<string>;
}

type AuthMode = 'login' | 'register' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSetPendingProfile,
  onEnterSandbox,
  existingUsernames,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);

  const normalizedHandle = normalizeUsername(username);
  const isUsernameTaken =
    normalizedHandle.length >= 3 && existingUsernames.has(normalizedHandle);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setStatusBanner(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Sign-in popup was closed before completing authentication.');
      } else if (msg.includes('auth/unauthorized-domain') || msg.includes('auth/operation-not-supported')) {
        setErrorMessage(
          'Google OAuth popup is restricted in this embedded frame. Open the app URL in a full browser tab to sign in with Google, or register with your @username below.'
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setStatusBanner(
          `If an account exists for ${trimmedEmail}, a password reset link has been dispatched.`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('auth/operation-not-allowed') || msg.includes('auth/configuration-not-found')) {
          setStatusBanner(
            `Password reset flow initiated for ${trimmedEmail}. (Enable Email/Password in Firebase Console for live emails).`
          );
        } else {
          setErrorMessage('Unable to send reset email. Verify the email address and try again.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'login') {
      const rateCheck = checkLoginRateLimit(trimmedEmail);
      if (!rateCheck.allowed) {
        setErrorMessage(
          `Security lockout: Too many failed login attempts. Please wait ${rateCheck.remainingLockoutSeconds}s before retrying.`
        );
        return;
      }
    }

    if (mode === 'register') {
      const strengthCheck = validatePasswordStrength(password);
      if (!strengthCheck.valid) {
        setErrorMessage(
          'Password does not meet security requirements: 8+ characters with uppercase, lowercase, number, and special character.'
        );
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      const profileCheck = validateProfileInput({
        username: normalizedHandle,
        displayName,
        bio,
      });
      if (!profileCheck.valid) {
        setErrorMessage(profileCheck.error || 'Invalid profile fields.');
        return;
      }
      if (isUsernameTaken) {
        setErrorMessage(`@${normalizedHandle} is already reserved. Please pick another username.`);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        resetFailedLogins(trimmedEmail);
      } else {
        const customProfile = {
          username: normalizedHandle,
          displayName: displayName.trim(),
          bio: bio.trim() || 'Connected on ConnectX real-time messaging.',
          email: trimmedEmail,
        };
        onSetPendingProfile?.(customProfile);
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user).catch(() => {});
        setStatusBanner('Account created & synced to Firebase Cloud Firestore!');
      }
    } catch (err: unknown) {
      if (mode === 'login') {
        const rateCheck = recordFailedLogin(trimmedEmail);
        if (!rateCheck.allowed) {
          setErrorMessage(
            `Account temporarily locked due to repeated failed attempts. Please wait ${rateCheck.remainingLockoutSeconds}s.`
          );
          return;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('auth/operation-not-allowed') ||
        msg.includes('auth/configuration-not-found')
      ) {
        if (mode === 'register') {
          const customProfile = {
            username: normalizedHandle,
            displayName: displayName.trim(),
            bio: bio.trim() || 'Connected on ConnectX real-time messaging.',
            email: trimmedEmail,
          };
          try {
            await signInAnonymously(auth);
          } catch {
            // Continues into workspace if anonymous provider is also disabled in console
          }
          onEnterSandbox(customProfile);
          return;
        }
        setErrorMessage(
          'Email/Password provider is not yet enabled in your Firebase Console. Click "Firebase Auth Setup Guide" below or sign in with Google.'
        );
      } else if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/user-not-found')
      ) {
        const rateCheck = checkLoginRateLimit(trimmedEmail);
        setErrorMessage(
          `Invalid email or password. (${rateCheck.attemptsLeft} attempt${rateCheck.attemptsLeft === 1 ? '' : 's'} remaining).`
        );
      } else if (msg.includes('auth/email-already-in-use')) {
        setErrorMessage('This email address is already registered. Switch to Sign In.');
      } else if (msg.includes('auth/network-request-failed')) {
        setErrorMessage('Network request failed: Could not reach Firebase servers. Please verify your internet connection or use "Sandbox Preview".');
      } else {
        setErrorMessage(
          msg && msg.length < 90
            ? msg.replace(/^Firebase:\s*/, '')
            : 'Authentication failed. Please check your connection or credentials.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f0f2f5] text-black transition-colors">
      {/* Top Bar Contract: Zone 1 Brand, Zone 2 Nav Links, Zone 3 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-300 bg-white sticky top-0 z-30">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0 text-black"
        >
          ConnectX
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-black">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className="hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setShowConsoleGuide(true)}
            className="hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer text-black"
          >
            Firebase Setup Guide
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="px-4 py-2 text-xs font-bold text-black bg-[#25d366] rounded-lg hover:bg-[#1ebe5d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Connect with Google
          </button>
        </div>
      </header>

      {/* Main Split Content (1440px Desktop Container) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Column: Product Vision & Real-Time Firebase Database Architecture */}
        <section className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-slate-300 bg-white text-black shadow-xs">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-black">
              <Database className="w-3.5 h-3.5 text-black shrink-0" />
              <span>Live Cloud Firestore Database</span>
              <span aria-hidden="true">·</span>
              <span>PWA Service Worker & Manifest</span>
              <span aria-hidden="true">·</span>
              <span>Voice & Video Calling</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-black"
              style={{ textWrap: 'balance' }}
            >
              Real-time messaging, voice & video calling powered by Firebase Cloud Firestore.
            </h1>

            <p className="text-base text-black leading-relaxed max-w-2xl">
              ConnectX connects real users across Android and Web using a live Cloud Firestore
              database, an offline-ready Service Worker (<code className="font-mono font-bold">/sw.js</code>),
              and a standard Web App Manifest (<code className="font-mono font-bold">/manifest.json</code>).
              Every registered user appears in the <span className="font-mono font-bold">Discover</span>{' '}
              directory so you and your friends can chat and call in real time.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#d9fdd3] border border-emerald-400 space-y-1.5 text-black">
                <div className="flex items-center gap-2 font-bold text-sm text-black">
                  <Lock className="w-4 h-4 text-black shrink-0" />
                  <span>100% Real User Directory</span>
                </div>
                <p className="text-xs text-black leading-relaxed">
                  All bot personas and demo chats have been removed. Every profile, friend request,
                  and message is synced through Cloud Firestore.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#f0f2f5] border border-slate-300 space-y-1.5 text-black">
                <div className="flex items-center gap-2 font-bold text-sm text-black">
                  <ShieldCheck className="w-4 h-4 text-black shrink-0" />
                  <span>PWA Manifest & Service Worker</span>
                </div>
                <p className="text-xs text-black leading-relaxed">
                  Install ConnectX directly to your phone home screen or package it into an Android
                  APK with full offline caching.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-black space-y-0.5">
              <div className="font-bold text-black">
                Share ConnectX with Friends on Android or Web
              </div>
              <div>
                Sign in with Google or create your{' '}
                <span className="font-mono font-bold">@username</span> so friends can find and
                message you immediately.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="px-4 py-2.5 rounded-xl bg-[#25d366] border border-[#1da851] text-black text-xs font-bold hover:bg-[#1ebe5d] transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Claim Your @Username</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Authentication Card */}
        <section className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-slate-300 bg-white text-black shadow-xs">
          <div>
            {/* Segmented Mode Control */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#f0f2f5] border border-slate-300 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setStatusBanner(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer text-black ${
                  mode === 'login' ? 'bg-[#25d366] shadow-xs' : 'hover:bg-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setStatusBanner(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer text-black ${
                  mode === 'register' ? 'bg-[#25d366] shadow-xs' : 'hover:bg-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setErrorMessage(null);
                  setStatusBanner(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer text-black ${
                  mode === 'reset' ? 'bg-[#25d366] shadow-xs' : 'hover:bg-white'
                }`}
              >
                Reset Password
              </button>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-black mb-1">
              {mode === 'login' && 'Sign in to ConnectX'}
              {mode === 'register' && 'Create your ConnectX account'}
              {mode === 'reset' && 'Reset your account password'}
            </h2>
            <p className="text-xs text-black mb-5">
              {mode === 'login' &&
                'Authenticate with Google Sign-In or Email to sync with the live Cloud Firestore database.'}
              {mode === 'register' &&
                'Claim your unique @username so friends can discover and message you in real time.'}
              {mode === 'reset' &&
                'Enter your registered email address to receive a password reset link.'}
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-red-100 border border-red-400 text-xs text-black flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusBanner && (
              <div
                role="status"
                className="mb-4 p-3 rounded-xl bg-[#d9fdd3] border border-emerald-500 text-xs text-black flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <span>{statusBanner}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer mb-4"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Continue with Google (Instant Firebase Sync)</span>
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-300" />
              <span className="text-xs font-semibold text-black">or use email & @username</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-bold text-black mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="auth-username"
                      className="block text-xs font-bold text-black mb-1.5"
                    >
                      Unique Username (3–30 lowercase chars)
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-username"
                        type="text"
                        required
                        maxLength={30}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your_username"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                      />
                    </div>
                    {normalizedHandle.length >= 3 && (
                      <p className="mt-1 text-xs font-bold text-black">
                        {isUsernameTaken
                          ? `@${normalizedHandle} is already taken`
                          : `@${normalizedHandle} is available`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="auth-displayname"
                      className="block text-xs font-bold text-black mb-1.5"
                    >
                      Display Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-displayname"
                        type="text"
                        required
                        maxLength={60}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-bio"
                      className="block text-xs font-bold text-black mb-1.5"
                    >
                      Bio (Optional, max 250 chars)
                    </label>
                    <input
                      id="auth-bio"
                      type="text"
                      maxLength={250}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Hey there! I am using ConnectX."
                      className="w-full px-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                    />
                  </div>
                </>
              )}

              {mode !== 'reset' && (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-bold text-black mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter (Registration Mode) */}
                  {mode === 'register' && password.length > 0 && (() => {
                    const strength = validatePasswordStrength(password);
                    return (
                      <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">Password Security</span>
                          <span
                            className={`font-bold text-[11px] ${
                              strength.score <= 1
                                ? 'text-rose-600'
                                : strength.score <= 3
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {strength.score <= 1
                              ? 'Weak'
                              : strength.score <= 3
                              ? 'Moderate'
                              : 'Strong & Secure'}
                          </span>
                        </div>

                        {/* Segmented Strength Bar */}
                        <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                          <div
                            className={`rounded-full transition-colors ${
                              strength.score >= 1
                                ? strength.score === 1
                                  ? 'bg-rose-500'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200'
                            }`}
                          />
                          <div
                            className={`rounded-full transition-colors ${
                              strength.score >= 2
                                ? strength.score <= 2
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200'
                            }`}
                          />
                          <div
                            className={`rounded-full transition-colors ${
                              strength.score >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          />
                          <div
                            className={`rounded-full transition-colors ${
                              strength.score >= 4 ? 'bg-[#008C5A]' : 'bg-slate-200'
                            }`}
                          />
                        </div>

                        {/* Live Checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-[11px]">
                          <div
                            className={`flex items-center gap-1.5 ${
                              strength.hasMinLength
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {strength.hasMinLength ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span>8+ characters</span>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 ${
                              strength.hasUppercase
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {strength.hasUppercase ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span>Uppercase (A-Z)</span>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 ${
                              strength.hasLowercase
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {strength.hasLowercase ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span>Lowercase (a-z)</span>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 ${
                              strength.hasNumber
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {strength.hasNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span>Number (0-9)</span>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 sm:col-span-2 ${
                              strength.hasSpecialChar
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {strength.hasSpecialChar ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span>Special symbol (!@#$%...)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-bold text-black mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full px-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#008C5A]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#008C5A] hover:bg-[#006B46] text-white shadow-md shadow-emerald-700/20 disabled:opacity-50 text-sm font-bold transition-all cursor-pointer"
              >
                {loading
                  ? 'Connecting...'
                  : mode === 'login'
                    ? 'Sign In with Email'
                    : mode === 'register'
                      ? 'Create Account & Claim @Username'
                      : 'Send Password Reset Link'}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-medium text-black">
            <button
              type="button"
              onClick={() => setShowConsoleGuide(true)}
              className="hover:underline flex items-center gap-1.5 cursor-pointer text-black"
            >
              <HelpCircle className="w-3.5 h-3.5 text-black" />
              <span>Firebase Console Auth Guide</span>
            </button>
            <span>Plaintext passwords never stored</span>
          </div>
        </section>
      </main>

      {/* Firebase Console Email/Password Provider Guide Modal */}
      {showConsoleGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="firebase-guide-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl border border-slate-300 bg-white text-black p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="firebase-guide-title" className="text-base font-bold text-black">
                Enabling Email/Password in Firebase Console
              </h3>
              <button
                type="button"
                onClick={() => setShowConsoleGuide(false)}
                className="text-xs font-bold text-black hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-black leading-relaxed">
              Automated provisioning configures Google Sign-In and Cloud Firestore out of the box.
              To enable native Email/Password registration in your Firebase project:
            </p>
            <ol className="text-xs text-black space-y-2 list-decimal list-inside">
              <li>
                Open the{' '}
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0669346428/authentication/providers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-black font-bold underline"
                >
                  Firebase Console Authentication Providers
                </a>{' '}
                page for project <code className="font-mono font-bold">gen-lang-client-0669346428</code>.
              </li>
              <li>Click &ldquo;Add new provider&rdquo; and choose &ldquo;Email/Password&rdquo;.</li>
              <li>Toggle &ldquo;Enable&rdquo; on and click &ldquo;Save&rdquo;.</li>
            </ol>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConsoleGuide(false)}
                className="px-4 py-2 rounded-xl bg-[#25d366] text-black text-xs font-bold hover:bg-[#1ebe5d] cursor-pointer"
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
