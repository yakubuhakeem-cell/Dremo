import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  ShieldAlert, 
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Compass
} from 'lucide-react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from '../firebase';
import { User } from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
  onGoogleSignIn: () => Promise<void>;
}

// Local storage interfaces for offline terminal testing
interface LocalCashier {
  email: string;
  name: string;
  passwordHash: string;
}

const getLocalCashiers = (): LocalCashier[] => {
  try {
    const data = localStorage.getItem('dremo_local_cashiers');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalCashiers = (list: LocalCashier[]) => {
  try {
    localStorage.setItem('dremo_local_cashiers', JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage write error", e);
  }
};

export default function AuthModal({ isOpen, onClose, onAuthSuccess, onGoogleSignIn }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Sandbox mode detection & activation switches
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [showSandboxOption, setShowSandboxOption] = useState(false);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const emailTrimmed = email.trim();
    const displayNameTrimmed = displayName.trim();

    if (!emailTrimmed) {
      setError("Please provide a valid cashier email address.");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long for cloud security.");
      setLoading(false);
      return;
    }

    // Process using offline backup sandbox if enabled
    if (isSandboxMode) {
      const list = getLocalCashiers();
      if (mode === 'register') {
        if (!displayNameTrimmed) {
          setError("Please state the Cashier's Display Name.");
          setLoading(false);
          return;
        }

        const existing = list.find(c => c.email.toLowerCase() === emailTrimmed.toLowerCase());
        if (existing) {
          setError("This e-mail is already registered for a local sandbox operator.");
          setLoading(false);
          return;
        }

        const newCashier: LocalCashier = {
          email: emailTrimmed,
          name: displayNameTrimmed,
          passwordHash: password
        };
        list.push(newCashier);
        saveLocalCashiers(list);

        setSuccessMsg(`Operator account for "${displayNameTrimmed}" registered successfully (Local Sandbox)!`);
        
        setTimeout(() => {
          onAuthSuccess({
            uid: `sandbox-${emailTrimmed}`,
            displayName: displayNameTrimmed,
            email: emailTrimmed,
            isLocalSandbox: true
          } as any as User);
          onClose();
        }, 1500);
      } else {
        // Local Sign In
        const cashier = list.find(c => c.email.toLowerCase() === emailTrimmed.toLowerCase() && c.passwordHash === password);
        if (!cashier) {
          setError("Incorrect email address or password for Local Sandbox cashier profile.");
          setLoading(false);
          return;
        }

        setSuccessMsg(`Welcome back, Cashier ${cashier.name}! (Local Sandbox)`);
        
        setTimeout(() => {
          onAuthSuccess({
            uid: `sandbox-${emailTrimmed}`,
            displayName: cashier.name,
            email: emailTrimmed,
            isLocalSandbox: true
          } as any as User);
          onClose();
        }, 1200);
      }
      setLoading(false);
      return;
    }

    try {
      if (mode === 'register') {
        if (!displayNameTrimmed) {
          setError("Please state the Cashier's Display Name.");
          setLoading(false);
          return;
        }

        // 1. Create firebase user auth credential
        const userCred = await createUserWithEmailAndPassword(auth, emailTrimmed, password);
        
        // 2. Set profile display name
        await updateProfile(userCred.user, {
          displayName: displayNameTrimmed
        });

        setSuccessMsg(`Operator account for "${displayNameTrimmed}" registered successfully!`);
        
        // Force state update to trigger observers
        setTimeout(() => {
          onAuthSuccess(userCred.user);
          onClose();
        }, 1500);
      } else {
        // Sign In
        const userCred = await signInWithEmailAndPassword(auth, emailTrimmed, password);
        setSuccessMsg(`Welcome back, Cashier ${userCred.user.displayName || userCred.user.email}!`);
        
        setTimeout(() => {
          onAuthSuccess(userCred.user);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error("Authentication Error: ", err);
      let localizedError = "Authentication failed. Please verify credentials and network link.";
      
      if (err.code === 'auth/operation-not-allowed') {
        localizedError = "Email/Password sign-ins are not yet enabled in this Firebase dashboard.";
        setShowSandboxOption(true);
      } else if (err.code === 'auth/email-already-in-use') {
        localizedError = "This e-mail is already registered for an operator.";
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        localizedError = "Incorrect email address or password. Please try again.";
      } else if (err.code === 'auth/invalid-email') {
        localizedError = "The email address layout is formatted incorrectly.";
      } else if (err.message) {
        localizedError = err.message;
      }
      setError(localizedError);
    } finally {
      setLoading(false);
    }
  };

  const executeGoogleAuth = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await onGoogleSignIn();
      onClose();
    } catch (e: any) {
      setError(e.message || "Google Cloud sign-in verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(prev => prev === 'signin' ? 'register' : 'signin');
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark frosted overlay */}
      <div 
        id="auth-modal-overlay"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      ></div>

      {/* Card Window container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl transition-all scale-100">
        
        {/* Decorative Top Accent line */}
        <div className={`h-1 bg-gradient-to-r ${
          isSandboxMode 
            ? 'from-amber-500 via-orange-500 to-amber-600' 
            : 'from-indigo-500 via-purple-500 to-indigo-600'
        }`} />

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {mode === 'signin' ? (
                  <>
                    <LogIn className={`size-5 ${isSandboxMode ? 'text-amber-400 font-bold animate-pulse' : 'text-indigo-400'}`} />
                    <span>
                      {isSandboxMode ? 'Sandbox Cashier Entry' : 'Cashier Entrance Portal'}
                    </span>
                  </>
                ) : (
                  <>
                    <UserPlus className={`size-5 ${isSandboxMode ? 'text-amber-400 font-bold animate-pulse' : 'text-emerald-400'}`} />
                    <span>
                      {isSandboxMode ? 'Sandbox Operator Register' : 'Operator Registration'}
                    </span>
                  </>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                {isSandboxMode 
                  ? 'Offline local sandbox database session active.' 
                  : mode === 'signin' 
                    ? 'Access the synchronized cloud POS database.' 
                    : 'Establish a new secure terminal operator key.'}
              </p>
            </div>
            <button
              id="btn-close-auth-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Sandbox Status Badge */}
          {isSandboxMode && (
            <div className="mb-4 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-[11px] text-amber-400">
              <span className="flex items-center gap-1.5">
                <Compass className="size-3.5 animate-spin-slow text-amber-500" />
                <strong>Local Sandbox Active</strong> (Bypasses restriction)
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSandboxMode(false);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
              >
                Use Firebase
              </button>
            </div>
          )}

          {/* Feedback banners */}
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              
              {showSandboxOption && !isSandboxMode && (
                <div className="mt-2 p-2 bg-indigo-950/40 border border-indigo-700/30 rounded-lg space-y-2">
                  <p className="text-[10px] text-indigo-300 leading-relaxed font-sans">
                    Enable <strong>Offline Local Sandbox</strong> mode to avoid Firebase console permission blocks & test catalog immediately!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSandboxMode(true);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="size-3" /> Enable Offline Local Sandbox
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-start gap-2.5">
              <CheckCircle className="size-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="cashier-name">
                  Cashier Display Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <UserIcon className="size-4" />
                  </span>
                  <input
                    id="cashier-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="cashier-email">
                Cashier E-mail Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Mail className="size-4" />
                </span>
                <input
                  id="cashier-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cashier@shopname.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="cashier-password">
                Password {isSandboxMode && <span className="text-[10px] text-amber-500 font-normal">(stored locally)</span>}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock className="size-4" />
                </span>
                <input
                  id="cashier-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 bg-gradient-to-r text-white font-semibold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSandboxMode 
                  ? 'from-amber-600 to-amber-700 shadow-amber-500/10 hover:brightness-110' 
                  : mode === 'signin' 
                    ? 'from-indigo-600 to-indigo-700 shadow-indigo-500/10 hover:brightness-110' 
                    : 'from-emerald-600 to-emerald-700 shadow-emerald-500/10 hover:brightness-110'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="size-4 rounded-full border-2 border-slate-400 border-t-white animate-spin"></div>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="size-4" />
                  <span>{isSandboxMode ? 'Start Sandbox Session' : 'Start Cloud Session'}</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  <span>{isSandboxMode ? 'Create Sandbox Account' : 'Create Cashier Account'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Register / Sign-In buttons */}
          <div className="mt-4 text-center space-y-2">
            <div>
              <button
                type="button"
                id="btn-auth-mode-toggle"
                onClick={toggleMode}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium hover:underline"
              >
                {mode === 'signin' 
                  ? "Don't have an account? Register new cashier profile" 
                  : 'Already have a cashier password? Sign In here'}
              </button>
            </div>

            {!isSandboxMode ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSandboxMode(true);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[10px] text-amber-500/80 hover:text-amber-400 font-mono flex items-center justify-center gap-1 mx-auto transition-colors"
                >
                  <Compass className="size-3" /> Or switch immediately to Offline Local Sandbox Mode
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSandboxMode(false);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-sans flex items-center justify-center gap-1 mx-auto transition-colors"
                >
                  Or switch back to Standard Firebase mode
                </button>
              </div>
            )}
          </div>

          {/* Solid separator divider lines */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 font-mono text-[10px]">OR VERIFIED IDENTITY PROVIDER</span>
            </div>
          </div>

          {/* Google Sign In Option */}
          <button
            id="btn-auth-google"
            type="button"
            onClick={executeGoogleAuth}
            disabled={loading}
            className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-705 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
