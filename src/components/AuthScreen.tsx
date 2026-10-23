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
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from '../firebase';
import { normalizeUsername, validateProfileInput } from '../utils/connectxRules';

interface AuthScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
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
  darkMode,
  onToggleDarkMode,
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
          'Google OAuth popup is restricted in this preview frame. Use "Launch Interactive Workspace" below or sign in from a top-level browser tab.'
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
            `Password reset flow simulated for ${trimmedEmail}. (Enable Email/Password in Firebase Console for live emails).`
          );
        } else {
          setErrorMessage('Unable to send reset email. Verify the email address and try again.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (mode === 'register') {
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
      } else {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user);
        setStatusBanner('Account created! Verification email sent. Entering workspace...');
        onEnterSandbox({
          username: normalizedHandle,
          displayName: displayName.trim(),
          bio: bio.trim(),
          email: trimmedEmail,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('auth/operation-not-allowed') ||
        msg.includes('auth/configuration-not-found')
      ) {
        if (mode === 'register') {
          onEnterSandbox({
            username: normalizedHandle,
            displayName: displayName.trim(),
            bio: bio.trim() || 'New member on ConnectX.',
            email: trimmedEmail,
          });
          return;
        }
        setErrorMessage(
          'Email/Password provider is not yet enabled in your Firebase Console. Click "Firebase Auth Setup Guide" below or use "Continue to ConnectX Workspace" to test immediately.'
        );
      } else if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        setErrorMessage('Invalid email or password. Please check your credentials.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setErrorMessage('This email address is already registered. Switch to Sign In.');
      } else {
        setErrorMessage('Authentication failed. Please check your connection or credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar Contract: Zone 1 Brand, Zone 2 Nav Links, Zone 3 Primary Action */}
      <header
        className={`flex items-center justify-between gap-8 px-6 py-4 border-b ${
          darkMode ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-white/90'
        } backdrop-blur-md sticky top-0 z-30`}
      >
        <a
          href="#top"
          className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0 text-indigo-600 dark:text-indigo-400"
        >
          ConnectX
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setShowConsoleGuide(true)}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0"
          >
            Firebase Setup Guide
          </button>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0"
          >
            {darkMode ? 'Light Theme' : 'Dark Theme'}
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onEnterSandbox()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Launch Interactive Workspace
          </button>
        </div>
      </header>

      {/* Main Split Content (1440px Desktop Container) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Column: Product Vision & Architecture Highlights */}
        <section className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <span>Social Network & Real-Time Messaging</span>
              <span aria-hidden="true">·</span>
              <span>Material 3 Architecture</span>
              <span aria-hidden="true">·</span>
              <span>Zero-Trust Firestore Rules</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Private messaging and social discovery built with strict privacy by default.
            </h1>

            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              ConnectX combines one-to-one real-time conversations, unique{' '}
              <span className="font-mono text-indigo-600 dark:text-indigo-400">@username</span>{' '}
              discovery, mutual friend requests, and 24-hour ephemeral stories with server-enforced
              access controls and isolated personal data.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Participant-Gated Chats</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Deterministic conversation IDs prevent duplicate threads, and Master Gate rules
                  verify participant identity on every message.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>PII Isolation & Blocking</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Email addresses and notification settings are isolated in{' '}
                  <code className="font-mono">/users_private</code>, never exposed in public
                  username search.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Want to explore all 5 tabs immediately?
              </div>
              <div>
                Enter the pre-populated workspace as{' '}
                <span className="font-mono text-indigo-600 dark:text-indigo-400">@alex_rivera</span>{' '}
                to test Chats, Friends, Discover, Stories, and Security Rules.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEnterSandbox()}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Continue as @alex_rivera</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Right Column: Authentication Card */}
        <section className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            {/* Segmented Mode Control */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setStatusBanner(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'reset'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Reset Password
              </button>
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-1">
              {mode === 'login' && 'Sign in to ConnectX'}
              {mode === 'register' && 'Create your ConnectX account'}
              {mode === 'reset' && 'Reset your account password'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              {mode === 'login' &&
                'Authenticate with Firebase Auth or Google Sign-In to sync your encrypted session.'}
              {mode === 'register' &&
                'Claim your unique @username and configure your public profile.'}
              {mode === 'reset' &&
                'Enter your registered email address to receive a password reset link.'}
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusBanner && (
              <div
                role="status"
                className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{statusBanner}</span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="auth-username"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Unique Username (3–30 lowercase chars)
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-username"
                        type="text"
                        required
                        maxLength={30}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="alex_rivera"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {normalizedHandle.length >= 3 && (
                      <p
                        className={`mt-1 text-xs ${
                          isUsernameTaken
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isUsernameTaken
                          ? `@${normalizedHandle} is already taken`
                          : `@${normalizedHandle} is available`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="auth-displayname"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Display Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-displayname"
                        type="text"
                        required
                        maxLength={60}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-bio"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Bio (Optional, max 250 chars)
                    </label>
                    <input
                      id="auth-bio"
                      type="text"
                      maxLength={250}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Product designer & photographer..."
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {mode !== 'reset' && (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                    ? 'Sign In with Email'
                    : mode === 'register'
                      ? 'Create Account & Claim @Username'
                      : 'Send Password Reset Link'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Continue with Google (Firebase OAuth)</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setShowConsoleGuide(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="firebase-guide-title" className="text-base font-bold">
                Enabling Email/Password in Firebase Console
              </h3>
              <button
                type="button"
                onClick={() => setShowConsoleGuide(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Automated provisioning configures Google Sign-In and Cloud Firestore out of the box.
              To enable native Email/Password registration in your Firebase project:
            </p>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                Open the{' '}
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0669346428/authentication/providers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 underline"
                >
                  Firebase Console Authentication Providers
                </a>{' '}
                page for project <code className="font-mono">gen-lang-client-0669346428</code>.
              </li>
              <li>Click &ldquo;Add new provider&rdquo; and choose &ldquo;Email/Password&rdquo;.</li>
              <li>Toggle &ldquo;Enable&rdquo; on and click &ldquo;Save&rdquo;.</li>
            </ol>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConsoleGuide(false);
                  onEnterSandbox();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
              >
                Launch Interactive Workspace Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
