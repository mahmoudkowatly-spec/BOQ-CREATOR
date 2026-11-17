import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Eye,
  X,
  Search,
  UserPlus,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Ban,
  Trash2,
  Clock,
  CheckCircle,
  KeyRound,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, signInWithGoogle, logOut } from "@/lib/firebase";
import {
  getAllUsers,
  getAllInvitations,
  preAuthorizeUser,
  updateUserAndInvitationRole,
  toggleUserSuspension,
  deleteUserAccount,
  resetUserPassword,
  syncUserProfile,
  type UserRole,
  type AccountStatus,
  ROLE_PERMISSIONS,
  BOOTSTRAP_ADMIN_EMAIL,
} from "@/lib/user-roles";

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string | null;
  currentUserRole: UserRole;
}

interface MergedAccount {
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  uid?: string;
  createdAt?: string;
  isInvitationOnly: boolean;
}

export function UserPermissionsModal({
  isOpen,
  onClose,
  currentUserEmail,
  currentUserRole,
}: UserPermissionsModalProps) {
  const [accounts, setAccounts] = useState<MergedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("estimator");
  const [isAdding, setIsAdding] = useState(false);

  // Delete confirmation state
  const [deletingAccount, setDeletingAccount] = useState<MergedAccount | null>(null);

  // Firebase Cloud Auth session tracking
  const [cloudUser, setCloudUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCloudUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen && cloudUser) {
      loadAccounts();
    } else if (isOpen && !cloudUser) {
      setAccounts([]);
      setIsLoading(false);
    }
  }, [isOpen, cloudUser]);

  const formatModalError = (err: unknown, fallback: string) => {
    const raw = err instanceof Error ? err.message : String(err || '');
    if (raw.includes('CLOUD_AUTH_REQUIRED:')) {
      return raw.split('CLOUD_AUTH_REQUIRED:')[1].trim();
    }
    if (raw.startsWith('{') && raw.includes('operationType')) {
      return 'لا تملك الجلسة الحالية صلاحية كافية في قاعدة البيانات. يرجى إعادة توثيق الدخول بحساب Google للمدير.';
    }
    return raw || fallback;
  };

  const handleLinkGoogleAdmin = async () => {
    setIsLinkingGoogle(true);
    try {
      const cred = await signInWithGoogle();
      if (cred?.user) {
        const profile = await syncUserProfile(cred.user);
        if (profile.role !== 'admin') {
          await logOut();
          toast.error('هذا الحساب ليس لديه صلاحية مدير نظام.');
          return;
        }
        setCloudUser(cred.user);
        toast.success('تم توثيق جلسة المدير السحابية بنجاح!');
        await loadAccounts();
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(formatModalError(err, 'تعذر التوثيق بحساب Google'));
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const [users, invitations] = await Promise.all([
        getAllUsers(),
        getAllInvitations(),
      ]);

      const map = new Map<string, MergedAccount>();

      // Populate invitations first
      invitations.forEach((inv) => {
        const norm = inv.email.toLowerCase();
        map.set(norm, {
          email: norm,
          displayName: inv.displayName || norm.split("@")[0],
          role: inv.role || "estimator",
          status: inv.status || "pending",
          isInvitationOnly: true,
          createdAt: inv.createdAt,
        });
      });

      // Overlay registered users
      users.forEach((u) => {
        const norm = u.email.toLowerCase();
        const existing = map.get(norm);
        map.set(norm, {
          email: norm,
          displayName: u.displayName || existing?.displayName || norm.split("@")[0],
          role: u.role || existing?.role || "estimator",
          status: u.status || existing?.status || "active",
          uid: u.uid,
          isInvitationOnly: false,
          createdAt: u.createdAt || existing?.createdAt,
        });
      });

      // Always ensure bootstrap admin is included
      const superAdminNorm = BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      if (!map.has(superAdminNorm)) {
        map.set(superAdminNorm, {
          email: superAdminNorm,
          displayName: "المدير الأساسي للنظام",
          role: "admin",
          status: "active",
          isInvitationOnly: false,
        });
      }

      setAccounts(Array.from(map.values()));
    } catch (err: any) {
      console.warn("Load accounts notice:", err?.message || err);
      toast.error("فشل في تحميل الحسابات: " + formatModalError(err, "خطأ في الصلاحيات"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (account: MergedAccount, newRole: UserRole) => {
    if (!auth.currentUser) {
      return toast.error("يرجى توثيق الجلسة بحساب Google للمدير أولاً.");
    }
    if (account.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && newRole !== "admin") {
      return toast.error("لا يمكن تخفيض صلاحيات المدير الأساسي للنظام");
    }

    setBusyEmail(account.email);
    try {
      await updateUserAndInvitationRole(account.email, account.uid, newRole);
      setAccounts((prev) =>
        prev.map((a) => (a.email === account.email ? { ...a, role: newRole } : a))
      );
      toast.success(`تم تغيير صلاحية ${account.email} إلى "${ROLE_PERMISSIONS[newRole].label}"`);
    } catch (err: any) {
      console.warn("Update role notice:", err?.message || err);
      toast.error("فشل في تحديث الصلاحية: " + formatModalError(err, "خطأ غير متوقع"));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleToggleSuspension = async (account: MergedAccount) => {
    if (!auth.currentUser) {
      return toast.error("يرجى توثيق الجلسة بحساب Google للمدير أولاً.");
    }
    if (account.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return toast.error("لا يمكن تعليق حساب المدير الأساسي للنظام");
    }

    const nextSuspend = account.status !== "suspended";
    setBusyEmail(account.email);
    try {
      await toggleUserSuspension(account.email, account.uid, nextSuspend);
      setAccounts((prev) =>
        prev.map((a) =>
          a.email === account.email
            ? { ...a, status: nextSuspend ? "suspended" : "active" }
            : a
        )
      );
      toast.success(
        nextSuspend
          ? `تم إيقاف صلاحية دخول ${account.email} بنجاح`
          : `تم إعادة تفعيل صلاحية دخول ${account.email} بنجاح`
      );
    } catch (err: any) {
      console.warn("Toggle suspension notice:", err?.message || err);
      toast.error("فشل في تعديل حالة الحساب: " + formatModalError(err, ""));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleResetPassword = async (account: MergedAccount) => {
    if (!auth.currentUser) {
      return toast.error("يرجى توثيق الجلسة بحساب Google للمدير أولاً.");
    }
    if (account.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return toast.error("لا يمكن إعادة تعيين كلمة مرور المدير الأساسي من هنا");
    }

    setBusyEmail(account.email);
    try {
      await resetUserPassword(account.email, account.displayName, account.role);
      setAccounts((prev) =>
        prev.map((a) => (a.email === account.email ? { ...a, status: "pending" } : a))
      );
      toast.success(
        `تمت إعادة تعيين كلمة مرور ${account.email} بنجاح. يستطيع المهندس الآن كتابة كلمة مرور جديدة في تبويب التفعيل.`
      );
    } catch (err: any) {
      console.warn("Reset password notice:", err?.message || err);
      toast.error("فشل في إعادة تعيين كلمة المرور: " + formatModalError(err, ""));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    if (!auth.currentUser) {
      return toast.error("يرجى توثيق الجلسة بحساب Google للمدير أولاً.");
    }
    if (deletingAccount.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return toast.error("لا يمكن حذف حساب المدير الأساسي للنظام");
    }

    setBusyEmail(deletingAccount.email);
    try {
      await deleteUserAccount(deletingAccount.email, deletingAccount.uid);
      setAccounts((prev) => prev.filter((a) => a.email !== deletingAccount.email));
      toast.success(`تم حذف حساب ${deletingAccount.email} وسحب صلاحياته نهائياً`);
      setDeletingAccount(null);
    } catch (err: any) {
      console.warn("Delete account notice:", err?.message || err);
      toast.error("فشل في حذف الحساب: " + formatModalError(err, ""));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleAddPreauthorizedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      return toast.error("يرجى توثيق الجلسة بحساب Google للمدير أولاً قبل إضافة مهندسين.");
    }
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return toast.error("يرجى إدخال بريد إلكتروني صحيح");
    }

    setIsAdding(true);
    try {
      const inv = await preAuthorizeUser(email, newName.trim(), newRole);
      setAccounts((prev) => [
        {
          email: inv.email,
          displayName: inv.displayName,
          role: inv.role,
          status: "pending",
          isInvitationOnly: true,
          createdAt: inv.createdAt,
        },
        ...prev.filter((a) => a.email !== email),
      ]);
      setNewEmail("");
      setNewName("");
      setShowAddForm(false);
      toast.success(
        `تم اعتماد المهندس (${email}) بصلاحية (${ROLE_PERMISSIONS[newRole].label})! يستطيع الآن الدخول وتعيين كلمة مروره.`
      );
    } catch (err: any) {
      console.warn("Add user notice:", err?.message || err);
      toast.error("فشل إضافة المهندس: " + formatModalError(err, "خطأ في الصلاحيات"));
    } finally {
      setIsAdding(false);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.email.toLowerCase().includes(q) ||
      (a.displayName && a.displayName.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-card border-2 shadow-2xl p-6 relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 grid place-items-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                لوحة تفويض وإدارة المهندسين
                <Badge
                  variant="outline"
                  className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30"
                >
                  صلاحية المدير العام
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                أنت المسؤول الوحيد عن منح الصلاحية وتحديد دور كل مهندس. يقوم المهندس فقط بتعيين كلمة مروره.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Roles Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-800 dark:text-red-300">
                مدير النظام (Admin)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              تحكم كامل: تعديل وحذف كافة المقايسات، وإضافة وحظر وحذف المهندسين وتعديل أدوارهم.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                مهندس تسعير (Estimator)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              إنشاء وتعديل المقايسات، حساب الكميات، واختيار البنود وتصدير تقارير Excel/PDF.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                مشاهد / مراجع (Viewer)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              تدقيق ومراجعة بنود المقايسات وتصدير التقارير فقط دون صلاحية التعديل أو الحذف.
            </p>
          </div>
        </div>

        {/* Cloud Admin Auth Verification Banner when logged in via local password only */}
        {!cloudUser && (
          <div className="p-4 mb-4 rounded-xl border-2 border-amber-300 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-[240px]">
              <Lock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  توثيق جلسة المدير السحابية مطلوب لإدارة المهندسين
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  أنت مسجل الدخول حالياً بكلمة المرور (جلسة محلية). لعرض قائمة المهندسين أو إضافة/تعديل الصلاحيات في قاعدة البيانات السحابية، يرجى توثيق الجلسة بحساب Google للمدير ({BOOTSTRAP_ADMIN_EMAIL}).
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isLinkingGoogle}
              onClick={handleLinkGoogleAdmin}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 cursor-pointer shrink-0"
            >
              {isLinkingGoogle ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>تفعيل الإدارة بحساب Google</span>
            </Button>
          </div>
        )}

        {/* Action Controls: Search + Add Engineer + Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              className="pr-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={!cloudUser}
              onClick={() => setShowAddForm((v) => !v)}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {showAddForm ? "إغلاق النموذج" : "إضافة واعتماد مهندس جديد"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (cloudUser ? loadAccounts() : handleLinkGoogleAdmin())}
              disabled={isLoading || isLinkingGoogle}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Add User Drawer / Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddPreauthorizedUser}
            className="p-4 mb-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3"
          >
            <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              منح تفويض الدخول لمهندس جديد وتحديد دوره
            </div>
            <p className="text-[11px] text-muted-foreground">
              بمجرد الإضافة، سيتمكن المهندس من كتابة بريده في صفحة الدخول وتعيين كلمة مروره الخاصة لأول مرة.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  البريد الإلكتروني للشركة أو Outlook *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="engineer@company.com / @outlook"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  الاسم الكامل للمهندس *
                </label>
                <Input
                  required
                  placeholder="م. أحمد محمد"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  الدور والصلاحية المعتمدة *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full text-xs h-9 px-2 rounded-md border border-input bg-background font-medium"
                >
                  <option value="estimator">مهندس تسعير (محرر مقايسات)</option>
                  <option value="viewer">مشاهد / مراجع (قراءة وتصدير فقط)</option>
                  <option value="admin">مدير النظام (كامل الصلاحيات)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isAdding}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-1" />
                ) : (
                  <Check className="w-4 h-4 ml-1" />
                )}
                اعتماد المهندس ومنحه الصلاحية
              </Button>
            </div>
          </form>
        )}

        {/* Delete Confirmation Alert Modal */}
        {deletingAccount && (
          <div className="p-4 mb-4 rounded-xl border-2 border-red-500/50 bg-red-50 dark:bg-red-950/40 space-y-3">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs">
              <Trash2 className="w-4 h-4 text-red-600" />
              تأكيد حذف الحساب وسحب صلاحية الدخول نهائياً
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">
              هل أنت متأكد من حذف حساب المهندس <strong>{deletingAccount.email}</strong>؟ لن يتمكن من تسجيل الدخول للمنصة بعد الآن إلا إذا قمت بإضافته مجدداً.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeletingAccount(null)}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busyEmail === deletingAccount.email}
                onClick={handleConfirmDelete}
              >
                {busyEmail === deletingAccount.email ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-1" />
                ) : (
                  <Trash2 className="w-4 h-4 ml-1" />
                )}
                نعم، احذف الحساب نهائياً
              </Button>
            </div>
          </div>
        )}

        {/* Accounts Table */}
        <div className="flex-1 overflow-auto border rounded-xl">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">جارٍ جلب قائمة المهندسين المعتمدين...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold">لا يوجد مهندسون مسجلون حالياً</p>
              <p className="text-xs mt-1">
                اضغط على زر (إضافة واعتماد مهندس جديد) أعلاه لمنح حق الدخول لأي موظف بشركتك.
              </p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/80 sticky top-0 border-b">
                <tr>
                  <th className="p-3 font-bold">المهندس / المستخدم</th>
                  <th className="p-3 font-bold">البريد الإلكتروني</th>
                  <th className="p-3 font-bold">حالة الحساب</th>
                  <th className="p-3 font-bold">الدور والصلاحية</th>
                  <th className="p-3 font-bold text-center">إجراءات المدير</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAccounts.map((acc) => {
                  const isCurrent = acc.email === currentUserEmail;
                  const isPrimaryAdmin =
                    acc.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                  const isBusy = busyEmail === acc.email;

                  return (
                    <tr key={acc.email} className="hover:bg-muted/30 transition-colors">
                      {/* Name */}
                      <td className="p-3">
                        <div className="font-semibold flex items-center gap-2">
                          <span>{acc.displayName || "مهندس"}</span>
                          {isCurrent && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 border-primary text-primary"
                            >
                              أنت
                            </Badge>
                          )}
                          {isPrimaryAdmin && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 border-red-500 text-red-600 bg-red-50"
                            >
                              المدير العام
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-3 font-mono text-muted-foreground">
                        {acc.email}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {acc.status === "active" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            مفعّل ونشط
                          </span>
                        ) : acc.status === "suspended" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                            <Ban className="w-3 h-3 text-red-600" />
                            معطّل من الإدارة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            في انتظار تعيين كلمة المرور
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            ROLE_PERMISSIONS[acc.role]?.badgeColor || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {acc.role === "admin" && <ShieldAlert className="w-3 h-3" />}
                          {acc.role === "estimator" && <UserCheck className="w-3 h-3" />}
                          {acc.role === "viewer" && <Eye className="w-3 h-3" />}
                          {ROLE_PERMISSIONS[acc.role]?.label.split(" ")[0]}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        {isBusy ? (
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-[11px]">جارٍ التحديث...</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {/* Role Dropdown / Switch */}
                            {!isPrimaryAdmin && (
                              <select
                                value={acc.role}
                                onChange={(e) =>
                                  handleRoleChange(acc, e.target.value as UserRole)
                                }
                                className="text-[11px] h-7 px-1.5 rounded-md border bg-background font-medium"
                                title="تغيير صلاحية المهندس"
                              >
                                <option value="estimator">مهندس تسعير</option>
                                <option value="viewer">مشاهد / مراجع</option>
                                <option value="admin">مدير النظام</option>
                              </select>
                            )}

                            {/* Reset Password */}
                            {!isPrimaryAdmin && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 cursor-pointer"
                                onClick={() => handleResetPassword(acc)}
                                title="إعادة تعيين كلمة المرور للمهندس ليقوم بتعيين كلمة جديدة"
                              >
                                <KeyRound className="w-3 h-3 ml-1" />
                                تصفير المرور
                              </Button>
                            )}

                            {/* Suspend / Resume Toggle */}
                            {!isPrimaryAdmin && (
                              <Button
                                type="button"
                                size="sm"
                                variant={acc.status === "suspended" ? "default" : "outline"}
                                className={`h-7 px-2 text-[11px] cursor-pointer ${
                                  acc.status === "suspended"
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "text-amber-700 hover:text-amber-800 border-amber-300 hover:bg-amber-50"
                                }`}
                                onClick={() => handleToggleSuspension(acc)}
                                title={
                                  acc.status === "suspended"
                                    ? "إعادة تفعيل صلاحية الدخول"
                                    : "إيقاف مؤقت لصلاحية الدخول"
                                }
                              >
                                {acc.status === "suspended" ? "تفعيل" : "تعطيل"}
                              </Button>
                            )}

                            {/* Delete User */}
                            {!isPrimaryAdmin && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => setDeletingAccount(acc)}
                                title="حذف الحساب نهائياً من النظام"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            أي تعديل على الصلاحيات أو حالات الإيقاف ينعكس فوراً على مستوى خادم Firestore وقواعد الأمان.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </Card>
    </div>
  );
}
