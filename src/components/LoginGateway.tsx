import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileSpreadsheet,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Mail,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import {
  checkEmailAuthorization,
  activateAndSetPassword,
  verifyAndLoginWithPassword,
  ROLE_PERMISSIONS,
  type Invitation,
  type UserProfile,
  BOOTSTRAP_ADMIN_EMAIL,
} from "@/lib/user-roles";
import { signInWithGoogle } from "@/lib/firebase";
import { toast } from "sonner";

interface LoginGatewayProps {
  onSuccessLogin: (user: any, token?: string, profile?: UserProfile) => Promise<void>;
}

export function LoginGateway({ onSuccessLogin }: LoginGatewayProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "activate">("signin");

  // Sign in form state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [isSigningInEmail, setIsSigningInEmail] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);

  // Activation form state
  const [activateEmail, setActivateEmail] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [verifiedInvitation, setVerifiedInvitation] = useState<Invitation | null>(null);
  const [isSuperAdminActivation, setIsSuperAdminActivation] = useState(false);
  const [isExistingPasswordReset, setIsExistingPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmittingActivation, setIsSubmittingActivation] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // General error banner
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Handle Google Sign-in (for Super Admin & users with Google accounts)
  const handleGoogleLogin = async () => {
    setIsSigningInGoogle(true);
    setAuthErrorMessage(null);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        await onSuccessLogin(res.user);
      }
    } catch (err: any) {
      console.warn("Google sign-in notice:", err?.message);
      if (err.message?.includes("UNAUTHORIZED_ACCOUNT")) {
        setAuthErrorMessage(
          `عذراً، هذا البريد الإلكتروني غير مصرّح له بالدخول إلى المنصة. يرجى التواصل مع مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}) لمنحك الصلاحية.`
        );
      } else if (err.message?.includes("SUSPENDED_ACCOUNT")) {
        setAuthErrorMessage("تم تعليق صلاحية هذا الحساب من قِبل إدارة النظام. يرجى مراجعة المدير.");
      } else if (err.code !== "auth/popup-closed-by-user") {
        toast.error("تعذر إتمام الدخول بحساب Google: " + (err.message || ""));
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  // Switch to activate / reset tab with given email and automatically verify
  const goToResetOrActivate = async (emailToUse: string) => {
    const cleanEmail = emailToUse.trim().toLowerCase();
    setActiveTab("activate");
    setAuthErrorMessage(null);
    setActivationError(null);
    if (!cleanEmail) return;

    setActivateEmail(cleanEmail);
    setIsCheckingAuth(true);
    setVerifiedInvitation(null);
    setIsSuperAdminActivation(false);
    setIsExistingPasswordReset(false);

    try {
      const check = await checkEmailAuthorization(cleanEmail);
      if (check.isSuperAdmin) {
        setIsSuperAdminActivation(true);
        setIsExistingPasswordReset(Boolean(check.hasPassword));
      } else if (check.isSuspended) {
        setActivationError("تم تعليق هذا الحساب من قِبل مدير النظام، لا يمكن تعيين كلمة مرور له حالياً.");
      } else if (!check.isAuthorized || !check.invitation) {
        setActivationError(
          `البريد (${cleanEmail}) غير مسجل في قائمة المهندسين المصرّح لهم. يرجى مراجعة مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}).`
        );
      } else {
        setVerifiedInvitation(check.invitation);
        setIsExistingPasswordReset(Boolean(check.hasPassword));
      }
    } catch (err: any) {
      console.warn("Authorization check notice:", err?.message);
      setActivationError("فشل في التحقق من السجلات: " + (err.message || "خطأ في الاتصال"));
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Handle Email & Password Sign In (for Outlook, Microsoft 365, Company domains)
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      return toast.error("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    }

    setIsSigningInEmail(true);
    setAuthErrorMessage(null);
    try {
      const res = await verifyAndLoginWithPassword(signInEmail.trim(), signInPassword);
      toast.success(`مرحباً ${res.userProfile.displayName}! تم تسجيل الدخول بنجاح`);
      await onSuccessLogin(res.customUser, undefined, res.userProfile);
    } catch (err: any) {
      console.warn("Sign-in credential notice:", err?.message);
      const msg = err.message || "تعذر تسجيل الدخول";
      setAuthErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSigningInEmail(false);
    }
  };

  // Step 1: Check authorization before setting password
  const isSuperAdminSignIn = signInEmail.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  const handleInstantAdminSetPassword = async () => {
    if (!signInPassword || signInPassword.length < 4) {
      return toast.error("يرجى إدخال كلمة مرور من 4 أحرف على الأقل");
    }
    setIsSigningInEmail(true);
    setAuthErrorMessage(null);
    try {
      const res = await activateAndSetPassword(BOOTSTRAP_ADMIN_EMAIL, signInPassword);
      toast.success("تم اعتماد كلمة المرور وتسجيل الدخول كمدير عام بنجاح!");
      await onSuccessLogin(res.customUser, undefined, res.userProfile);
    } catch (err: any) {
      console.warn("Instant admin password notice:", err?.message);
      const msg = err?.message || "تعذر تحديث كلمة المرور";
      setAuthErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSigningInEmail(false);
    }
  };

  const handleCheckAuthorization = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = activateEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return toast.error("يرجى إدخال بريد إلكتروني صحيح");
    }

    setIsCheckingAuth(true);
    setActivationError(null);
    setVerifiedInvitation(null);
    setIsSuperAdminActivation(false);
    setIsExistingPasswordReset(false);

    try {
      const check = await checkEmailAuthorization(email);
      if (check.isSuperAdmin) {
        setIsSuperAdminActivation(true);
        setIsExistingPasswordReset(Boolean(check.hasPassword));
      } else if (check.isSuspended) {
        setActivationError("تم تعليق هذا الحساب من قِبل مدير النظام، لا يمكن تفعيله حالياً.");
      } else if (!check.isAuthorized || !check.invitation) {
        setActivationError(
          `البريد (${email}) غير مسجل في قائمة المهندسين المصرّح لهم. يجب أن يقوم مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}) بإضافتك وتحديد صلاحيتك أولاً.`
        );
      } else {
        setVerifiedInvitation(check.invitation);
        setIsExistingPasswordReset(Boolean(check.hasPassword));
      }
    } catch (err: any) {
      console.warn("Check authorization notice:", err?.message);
      setActivationError("فشل في التحقق من السجلات: " + (err.message || "خطأ في الاتصال"));
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Step 2: Set password and activate account
  const handleCompleteActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error("يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("كلمتا المرور غير متطابقتين");
    }

    const email = activateEmail.trim().toLowerCase();
    setIsSubmittingActivation(true);
    setActivationError(null);

    try {
      const res = await activateAndSetPassword(email, newPassword);
      toast.success(
        isExistingPasswordReset
          ? "تم تحديث كلمة المرور وتسجيل الدخول بنجاح!"
          : "تم تعيين كلمة المرور وتفعيل حسابك بنجاح!"
      );
      await onSuccessLogin(res.customUser, undefined, res.userProfile);
    } catch (err: any) {
      console.warn("Activation completion notice:", err?.message);
      setActivationError(err.message || "فشل تفعيل الحساب");
    } finally {
      setIsSubmittingActivation(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900 font-sans"
    >
      {/* Top Header */}
      <header className="border-b border-slate-200/90 bg-white py-3.5 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                منصة إعداد المقايسات الهندسية
              </div>
              <div className="text-xs text-slate-500">
                الهيئة العامة للأبنية التعليمية • قائمة أسعار 2026
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>بوابة الدخول المعتمدة</span>
          </div>
        </div>
      </header>

      {/* Main Centered Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-7">
            {/* Header within Card */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-slate-900">تسجيل الدخول للمنصة</h1>
              <p className="text-xs text-slate-500 mt-1">
                ادخل باستخدام بريدك المعتمد (Outlook أو البريد المؤسسي أو Google)
              </p>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-5 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signin");
                  setAuthErrorMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeTab === "signin"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("activate");
                  setAuthErrorMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeTab === "activate"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                تفعيل حساب جديد / تعيين المرور
              </button>
            </div>

            {/* General Error Banner */}
            {authErrorMessage && (
              <div className="p-3 mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{authErrorMessage}</span>
                </div>

                {isSuperAdminSignIn ? (
                  <div className="pt-2 border-t border-red-200/80 flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-red-900">
                      خيارات الدخول الفوري للمدير العام ({BOOTSTRAP_ADMIN_EMAIL}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleInstantAdminSetPassword}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 px-3 rounded-md cursor-pointer font-semibold"
                      >
                        اعتماد الكلمة المدخلة والدخول فوراً
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGoogleLogin}
                        className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 px-3 rounded-md cursor-pointer"
                      >
                        الدخول المباشر بحساب Google
                      </Button>
                    </div>
                  </div>
                ) : (
                  (authErrorMessage.includes("كلمة المرور غير صحيحة") ||
                    authErrorMessage.includes("لم يتم تعيين كلمة المرور") ||
                    authErrorMessage.includes("إعادة تعيين كلمة المرور")) && (
                    <div className="pt-2 border-t border-red-200/80 flex items-center justify-between">
                      <span className="text-[11px] text-red-700">نسيت كلمة المرور؟</span>
                      <button
                        type="button"
                        onClick={() => goToResetOrActivate(signInEmail)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                      >
                        إعادة تعيين كلمة المرور الآن ←
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* TAB 1: Sign In */}
            {activeTab === "signin" && (
              <div className="space-y-4">
                <form onSubmit={handleEmailSignIn} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      البريد الإلكتروني للشركة أو Outlook
                    </label>
                    <div className="relative">
                      <Input
                        type="email"
                        required
                        placeholder="name@company.com / name@outlook.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="bg-white border-slate-300 text-xs h-10 pr-9 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                      />
                      <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        كلمة المرور
                      </label>
                      <button
                        type="button"
                        onClick={() => goToResetOrActivate(signInEmail)}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer font-medium"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showSignInPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="bg-white border-slate-300 text-xs h-10 pr-9 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                      />
                      <KeyRound className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword((v) => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showSignInPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showSignInPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSigningInEmail}
                    className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                  >
                    {isSigningInEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        <span>جارٍ التحقق والدخول...</span>
                      </>
                    ) : (
                      <span>تسجيل الدخول</span>
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[11px]">
                    <span className="bg-white px-2.5 text-slate-400 font-medium">أو</span>
                  </div>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSigningInGoogle}
                  className="w-full h-10 flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 rounded-lg border border-slate-300 transition-colors cursor-pointer text-xs disabled:opacity-50 shadow-2xs"
                >
                  {isSigningInGoogle ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  )}
                  <span>المتابعة بحساب Google</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => goToResetOrActivate(signInEmail)}
                    className="text-xs text-slate-500 hover:text-emerald-700 underline cursor-pointer"
                  >
                    مهندس جديد معتمد؟ اضغط هنا لتعيين كلمة مرورك لأول مرة
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Activation & Setting Password */}
            {activeTab === "activate" && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isExistingPasswordReset
                      ? "إعادة تعيين كلمة المرور"
                      : "تفعيل الحساب وتعيين كلمة المرور"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isExistingPasswordReset
                      ? "أدخل كلمة المرور الجديدة لحسابك المعتمد"
                      : "تحقق من بريدك المعتمد ثم اختر كلمة المرور الخاصة بك"}
                  </p>
                </div>

                {activationError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{activationError}</span>
                  </div>
                )}

                {!verifiedInvitation && !isSuperAdminActivation ? (
                  /* Step 1: Check Authorization */
                  <form onSubmit={handleCheckAuthorization} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        البريد الإلكتروني المعتمد بالشركة أو Outlook
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="name@company.com / name@outlook.com"
                        value={activateEmail}
                        onChange={(e) => setActivateEmail(e.target.value)}
                        className="bg-white border-slate-300 text-xs h-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isCheckingAuth}
                      className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      {isCheckingAuth ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                          <span>جارٍ التحقق من الاعتماد...</span>
                        </>
                      ) : (
                        <span>التحقق والمتابعة</span>
                      )}
                    </Button>
                  </form>
                ) : (
                  /* Step 2: Set password */
                  <form onSubmit={handleCompleteActivation} className="space-y-3.5">
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>
                          تم التحقق:{" "}
                          {verifiedInvitation?.displayName || (isSuperAdminActivation ? "المدير العام" : "مهندس معتمد")}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        الصلاحية:{" "}
                        <strong>
                          {isSuperAdminActivation
                            ? "مدير عام النظام"
                            : verifiedInvitation
                            ? ROLE_PERMISSIONS[verifiedInvitation.role]?.label
                            : "مهندس معتمد"}
                        </strong>
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        {isExistingPasswordReset
                          ? "كلمة المرور الجديدة (6 أحرف أو أكثر)"
                          : "كلمة المرور الخاصة بك (6 أحرف أو أكثر)"}
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-white border-slate-300 text-xs h-10 pr-3 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        تأكيد كلمة المرور
                      </label>
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-white border-slate-300 text-xs h-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVerifiedInvitation(null);
                          setIsSuperAdminActivation(false);
                          setIsExistingPasswordReset(false);
                        }}
                        className="text-slate-600 hover:text-slate-900 text-xs border-slate-300"
                      >
                        رجوع
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmittingActivation}
                        className="flex-1 h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                      >
                        {isSubmittingActivation ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin ml-2" />
                            <span>جارٍ الحفظ والدخول...</span>
                          </>
                        ) : (
                          <span>
                            {isExistingPasswordReset
                              ? "حفظ كلمة المرور والدخول"
                              : "تفعيل الحساب والدخول"}
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Note footer */}
            <div className="pt-4 mt-5 border-t border-slate-100 text-center text-[11px] text-slate-400">
              يتم منح صلاحيات الدخول حصرياً بواسطة مدير النظام
            </div>
          </Card>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-3 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>منصة إعداد المقايسات الهندسية • إصدار 2026</span>
          <span>الهيئة العامة للأبنية التعليمية — جمهورية مصر العربية</span>
        </div>
      </footer>
    </div>
  );
}
