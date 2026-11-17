import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import {
  handleFirestoreError,
  isPermissionDeniedError,
  OperationType,
} from './firestore-errors';

export type UserRole = 'admin' | 'estimator' | 'viewer';
export type AccountStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invitation {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  passwordHash?: string;
  salt?: string;
  invitedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CloudProject {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  projectName: string;
  clientName?: string;
  orgName?: string;
  governorate?: string;
  refNumber?: string;
  discountPercent?: number;
  logoDataUrl?: string;
  estimate?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export const BOOTSTRAP_ADMIN_EMAIL = 'mahmoudkowatly@gmail.com';

export function hasCloudAuthSession(): boolean {
  return Boolean(auth.currentUser);
}

/**
 * Creates a safe, predictable document key for email lookups
 */
export function normalizeEmailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 120);
}

/**
 * Hashes a password with a cryptographic salt using SHA-256 via Web Crypto
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + '::' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if an email address is pre-authorized by the administrator
 */
export async function checkEmailAuthorization(email: string): Promise<{
  isAuthorized: boolean;
  isSuperAdmin: boolean;
  isSuspended: boolean;
  hasPassword?: boolean;
  invitation?: Invitation;
}> {
  const normEmail = email.trim().toLowerCase();
  const isSuperAdmin = normEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const key = normalizeEmailKey(normEmail);

  if (!normEmail || !key) {
    return {
      isAuthorized: false,
      isSuperAdmin: false,
      isSuspended: false,
      hasPassword: false,
    };
  }

  if (isSuperAdmin) {
    let inv: Invitation | undefined = undefined;
    try {
      const snap = await getDoc(doc(db, 'invitations', key));
      if (snap.exists()) {
        inv = snap.data() as Invitation;
      }
    } catch {
      // ignore lookup warning for super admin
    }
    return {
      isAuthorized: true,
      isSuperAdmin: true,
      isSuspended: false,
      hasPassword: Boolean(inv?.passwordHash && inv?.salt),
      invitation: inv,
    };
  }

  try {
    const snap = await getDoc(doc(db, 'invitations', key));
    if (snap.exists()) {
      const data = snap.data() as Invitation;
      const hasPassword = Boolean(data.passwordHash && data.salt);
      if (data.status === 'suspended') {
        return {
          isAuthorized: false,
          isSuperAdmin: false,
          isSuspended: true,
          hasPassword,
          invitation: data,
        };
      }
      return {
        isAuthorized: true,
        isSuperAdmin: false,
        isSuspended: false,
        hasPassword,
        invitation: data,
      };
    }
  } catch (err) {
    console.warn('Could not query invitations directly:', err);
  }

  return {
    isAuthorized: false,
    isSuperAdmin: false,
    isSuspended: false,
    hasPassword: false,
  };
}

/**
 * Activates an authorized account by setting its private password
 */
export async function activateAndSetPassword(
  email: string,
  pass: string
): Promise<{ userProfile: UserProfile; customUser: any }> {
  const normEmail = email.trim().toLowerCase();
  const isSuperAdmin = normEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const key = normalizeEmailKey(normEmail);

  if (!normEmail || !key) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
  }

  let displayName = normEmail.split('@')[0];
  let role: UserRole = 'estimator';

  if (!isSuperAdmin) {
    const snap = await getDoc(doc(db, 'invitations', key));
    if (!snap.exists()) {
      throw new Error(
        `عذراً، البريد (${normEmail}) غير مدرج في قائمة المهندسين المصرّح لهم. يرجى التواصل مع مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}).`
      );
    }

    const inv = snap.data() as Invitation;
    if (inv.status === 'suspended') {
      throw new Error('تم تعليق هذا الحساب من قِبل مدير النظام.');
    }

    if (inv.status === 'active' && inv.passwordHash && inv.salt && !auth.currentUser) {
      throw new Error(
        `هذا الحساب مفعّل بالفعل. لإعادة تعيين كلمة المرور، يرجى الطلب من مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}) الضغط على "تصفير المرور" لحسابك من لوحة الإدارة.`
      );
    }

    displayName = inv.displayName || displayName;
    role = inv.role || 'estimator';

    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const passwordHash = await hashPassword(pass, salt);
    const nowIso = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'invitations', key), {
        passwordHash,
        salt,
        status: 'active',
        updatedAt: nowIso,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        throw new Error(
          `تعذر تحديث كلمة المرور قبل إعادة تصفيرها من مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}).`
        );
      }
      throw err;
    }
  } else {
    role = 'admin';
    displayName = 'المدير العام (محمود كوتلي)';
    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const passwordHash = await hashPassword(pass, salt);
    const nowIso = new Date().toISOString();
    const invRef = doc(db, 'invitations', key);

    let existsAlready = false;
    try {
      const existingSnap = await getDoc(invRef);
      existsAlready = existingSnap.exists();
    } catch {
      existsAlready = false;
    }

    if (existsAlready && !auth.currentUser) {
      throw new Error(
        `تم تعيين كلمة مرور لحساب المدير العام (${BOOTSTRAP_ADMIN_EMAIL}) مسبقاً. لتغيير كلمة المرور بأمان، يرجى الدخول أولاً بزر Google ثم تحديث كلمة المرور.`
      );
    }

    try {
      if (existsAlready) {
        await updateDoc(invRef, {
          passwordHash,
          salt,
          status: 'active',
          updatedAt: nowIso,
        });
      } else {
        await setDoc(invRef, {
          id: key,
          email: normEmail,
          displayName,
          role: 'admin',
          status: 'active',
          passwordHash,
          salt,
          invitedBy: BOOTSTRAP_ADMIN_EMAIL,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        throw new Error(
          'لتحديث بيانات المدير العام، يرجى الدخول أولاً عبر زر Google لتوثيق الجلسة.'
        );
      }
      throw err;
    }
  }

  const fbUid = auth.currentUser?.uid;
  const effectiveUid = fbUid || `u_${key}`;
  const nowIso = new Date().toISOString();
  const profile: UserProfile = {
    uid: effectiveUid,
    email: normEmail,
    displayName,
    role,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Only sync /users and /admins when a real Firebase Auth session is active
  if (fbUid) {
    try {
      await setDoc(doc(db, 'users', fbUid), profile, { merge: true });
      if (role === 'admin' && isSuperAdmin) {
        await setDoc(
          doc(db, 'admins', fbUid),
          {
            uid: fbUid,
            email: normEmail,
            createdAt: nowIso,
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch (e) {
      console.warn('User profile setDoc notice:', e);
    }
  }

  const customUser = {
    uid: effectiveUid,
    email: normEmail,
    displayName,
    photoURL: auth.currentUser?.photoURL ?? null,
  };

  return { userProfile: profile, customUser };
}

/**
 * Verifies password and logs in an authorized engineer
 */
export async function verifyAndLoginWithPassword(
  email: string,
  pass: string
): Promise<{ userProfile: UserProfile; customUser: any }> {
  const normEmail = email.trim().toLowerCase();
  const key = normalizeEmailKey(normEmail);
  const isSuperAdmin = normEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  if (!normEmail || !key) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }

  // Special Handling for Super Admin:
  // The super admin is ALWAYS authorized and must NEVER receive an unauthorized error!
  if (isSuperAdmin) {
    let inv: Invitation | null = null;
    try {
      const snap = await getDoc(doc(db, 'invitations', key));
      if (snap.exists()) {
        inv = snap.data() as Invitation;
      }
    } catch (e) {
      console.warn('Super Admin invitation lookup notice:', e);
    }

    // If no password set yet or invitation doc not created, auto-bootstrap with the provided password!
    if (!inv || !inv.passwordHash || !inv.salt) {
      if (pass && pass.length >= 4) {
        return await activateAndSetPassword(normEmail, pass);
      }
      throw new Error(
        `حساب المدير العام (${BOOTSTRAP_ADMIN_EMAIL}): يرجى إدخال كلمة مرور من 4 أحرف على الأقل، أو تسجيل الدخول بزر Google.`
      );
    }

    // Verify existing password
    const computedHash = await hashPassword(pass, inv.salt);
    if (computedHash !== inv.passwordHash) {
      throw new Error(
        `كلمة المرور غير صحيحة لحساب المدير العام (${BOOTSTRAP_ADMIN_EMAIL}). يمكنك استخدام زر Google للدخول المباشر.`
      );
    }

    const customUid = `u_${key}`;
    const profile: UserProfile = {
      uid: customUid,
      email: normEmail,
      displayName: inv.displayName || 'المدير العام (محمود كوتلي)',
      role: 'admin',
      status: 'active',
      updatedAt: new Date().toISOString(),
    };

    const customUser = {
      uid: customUid,
      email: normEmail,
      displayName: profile.displayName,
      photoURL: null,
    };

    return { userProfile: profile, customUser };
  }

  // Regular users (Engineers, Estimators, Viewers)
  const snap = await getDoc(doc(db, 'invitations', key));
  if (!snap.exists()) {
    throw new Error(
      `البريد الإلكتروني (${normEmail}) غير مدرج في قائمة المهندسين المصرّح لهم. يرجى التواصل مع مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}) لإضافتك وتحديد صلاحياتك.`
    );
  }

  const inv = snap.data() as Invitation;
  if (inv.status === 'suspended') {
    throw new Error(`تم تعليق هذا الحساب من قِبل مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}).`);
  }

  if (!inv.passwordHash || !inv.salt) {
    throw new Error(
      `تم اعتماد بريدك (${normEmail}) مسبقاً، ولكن لم يتم تعيين كلمة المرور بعد. يرجى الانتقال إلى تبويب (تفعيل حساب جديد) لتعيين كلمة مرورك.`
    );
  }

  const computedHash = await hashPassword(pass, inv.salt);
  if (computedHash !== inv.passwordHash) {
    throw new Error('كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة أو مراجعة مدير النظام لتصفيرها.');
  }

  const customUid = `u_${key}`;
  const profile: UserProfile = {
    uid: customUid,
    email: normEmail,
    displayName: inv.displayName || normEmail.split('@')[0],
    role: inv.role || 'estimator',
    status: 'active',
    updatedAt: new Date().toISOString(),
  };

  const customUser = {
    uid: customUid,
    email: normEmail,
    displayName: profile.displayName,
    photoURL: null,
  };

  return { userProfile: profile, customUser };
}

function assertCloudAdminSession(): void {
  if (!auth.currentUser) {
    throw new Error(
      'CLOUD_AUTH_REQUIRED: يرجى تفعيل الجلسة السحابية بحساب Google أولاً لإدارة حسابات المهندسين في قاعدة البيانات.'
    );
  }
}

/**
 * Admin resets an engineer's password, requiring them to set a new password on next login
 */
export async function resetUserPassword(
  email: string,
  displayName?: string,
  role: UserRole = 'estimator'
): Promise<void> {
  assertCloudAdminSession();
  const normEmail = email.trim().toLowerCase();
  const key = normalizeEmailKey(normEmail);
  const path = `invitations/${key}`;
  const nowIso = new Date().toISOString();

  try {
    const ref = doc(db, 'invitations', key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        status: 'pending',
        passwordHash: '',
        salt: '',
        updatedAt: nowIso,
      });
    } else {
      await setDoc(ref, {
        id: key,
        email: normEmail,
        displayName: displayName?.trim() || normEmail.split('@')[0],
        role,
        status: 'pending',
        passwordHash: '',
        salt: '',
        invitedBy: auth.currentUser?.email || BOOTSTRAP_ADMIN_EMAIL,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    throw err;
  }
}

/**
 * Admin pre-authorizes an email and assigns its role
 */
export async function preAuthorizeUser(
  email: string,
  displayName: string,
  role: UserRole
): Promise<Invitation> {
  assertCloudAdminSession();
  const normEmail = email.trim().toLowerCase();
  const key = normalizeEmailKey(normEmail);
  const path = `invitations/${key}`;
  const nowIso = new Date().toISOString();

  const invitation: Invitation = {
    id: key,
    email: normEmail,
    displayName: (displayName.trim() || normEmail.split('@')[0]).slice(0, 128),
    role,
    status: 'pending',
    invitedBy: (auth.currentUser?.email || BOOTSTRAP_ADMIN_EMAIL).slice(0, 128),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'invitations', key), invitation);
    return invitation;
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    throw err;
  }
}

/**
 * Fetch all invitations for the Admin Console
 */
export async function getAllInvitations(): Promise<Invitation[]> {
  if (!auth.currentUser) {
    return [];
  }
  const invitationsRef = collection(db, 'invitations');
  try {
    const snapshot = await getDocs(invitationsRef);
    const list: Invitation[] = [];
    snapshot.forEach((snap) => {
      list.push(snap.data() as Invitation);
    });
    return list;
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.LIST, 'invitations');
    }
    console.warn('Could not load invitations:', err);
    return [];
  }
}

/**
 * Admin changes role of an invitation and user
 */
export async function updateUserAndInvitationRole(
  email: string,
  targetUid: string | undefined,
  newRole: UserRole
): Promise<void> {
  assertCloudAdminSession();
  const normEmail = email.trim().toLowerCase();
  const key = normalizeEmailKey(normEmail);
  const nowIso = new Date().toISOString();

  try {
    const invRef = doc(db, 'invitations', key);
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      await updateDoc(invRef, {
        role: newRole,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, `invitations/${key}`);
    }
    throw err;
  }

  if (targetUid && !targetUid.startsWith('u_')) {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        role: newRole,
        updatedAt: nowIso,
      });

      const adminRef = doc(db, 'admins', targetUid);
      if (newRole === 'admin') {
        await setDoc(adminRef, {
          uid: targetUid,
          email: normEmail,
          createdAt: nowIso,
        });
      } else {
        await deleteDoc(adminRef).catch(() => {});
      }
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
      }
      throw err;
    }
  }
}

/**
 * Admin toggles account suspension (block/unblock)
 */
export async function toggleUserSuspension(
  email: string,
  targetUid: string | undefined,
  suspend: boolean
): Promise<void> {
  assertCloudAdminSession();
  const key = normalizeEmailKey(email);
  const nowIso = new Date().toISOString();
  const newStatus: AccountStatus = suspend ? 'suspended' : 'active';

  try {
    const invRef = doc(db, 'invitations', key);
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      await updateDoc(invRef, {
        status: newStatus,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, `invitations/${key}`);
    }
    throw err;
  }

  if (targetUid && !targetUid.startsWith('u_')) {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        status: newStatus,
        updatedAt: nowIso,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
      }
      throw err;
    }
  }
}

/**
 * Admin deletes an authorized account completely
 */
export async function deleteUserAccount(
  email: string,
  targetUid: string | undefined
): Promise<void> {
  assertCloudAdminSession();
  const key = normalizeEmailKey(email);

  try {
    await deleteDoc(doc(db, 'invitations', key));
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, `invitations/${key}`);
    }
    throw err;
  }

  if (targetUid && !targetUid.startsWith('u_')) {
    try {
      await deleteDoc(doc(db, 'users', targetUid));
      await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `users/${targetUid}`);
      }
      throw err;
    }
  }
}

/**
 * Sync user profile in Firestore.
 * Verifies authorization against the whitelist before granting access.
 */
export async function syncUserProfile(firebaseUser: User): Promise<UserProfile> {
  const email = firebaseUser.email || '';
  const normEmail = email.trim().toLowerCase();
  const isBootstrapAdmin = normEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  let assignedRole: UserRole = 'estimator';
  let assignedName = firebaseUser.displayName || normEmail.split('@')[0] || 'مهندس';

  if (!isBootstrapAdmin) {
    const authCheck = await checkEmailAuthorization(normEmail);

    if (authCheck.isSuspended) {
      throw new Error(
        'SUSPENDED_ACCOUNT: تم تعليق صلاحية هذا الحساب من قِبل مدير النظام. يرجى مراجعة الإدارة.'
      );
    }

    if (!authCheck.isAuthorized) {
      throw new Error(
        `UNAUTHORIZED_ACCOUNT: البريد الإلكتروني (${normEmail}) غير مصرّح له بالدخول. يرجى التواصل مع مدير النظام (${BOOTSTRAP_ADMIN_EMAIL}) لمنحك الصلاحية.`
      );
    }

    if (authCheck.invitation) {
      assignedRole = authCheck.invitation.role || 'estimator';
      assignedName = authCheck.invitation.displayName || assignedName;
      if (authCheck.invitation.status !== 'active') {
        const key = normalizeEmailKey(normEmail);
        updateDoc(doc(db, 'invitations', key), {
          status: 'active',
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  } else {
    assignedRole = 'admin';
  }

  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      if (data.status === 'suspended' && !isBootstrapAdmin) {
        throw new Error('SUSPENDED_ACCOUNT: تم تعليق صلاحية هذا الحساب من قِبل مدير النظام.');
      }
      return {
        ...data,
        role: isBootstrapAdmin ? 'admin' : assignedRole || data.role,
      };
    } else {
      // Check if an admin marker already exists for this UID
      let hasAdminMarker = isBootstrapAdmin;
      if (!hasAdminMarker && assignedRole === 'admin') {
        try {
          const admSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          hasAdminMarker = admSnap.exists();
        } catch {
          hasAdminMarker = false;
        }
      }

      const persistedRole: UserRole = hasAdminMarker
        ? 'admin'
        : assignedRole === 'admin'
        ? 'estimator'
        : assignedRole;

      const nowIso = new Date().toISOString();
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: normEmail.slice(0, 128),
        displayName: assignedName.slice(0, 128),
        role: persistedRole,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(userRef, newProfile);

      if (isBootstrapAdmin) {
        await setDoc(doc(db, 'admins', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: normEmail.slice(0, 128),
          createdAt: nowIso,
        }).catch(() => {});
      }

      return {
        ...newProfile,
        role: isBootstrapAdmin ? 'admin' : assignedRole,
      };
    }
  } catch (err: any) {
    if (
      err.message?.includes('SUSPENDED_ACCOUNT') ||
      err.message?.includes('UNAUTHORIZED_ACCOUNT')
    ) {
      throw err;
    }
    console.warn('Firestore user profile sync warning, providing active session fallback:', err);
    return {
      uid: firebaseUser.uid,
      email: normEmail,
      displayName: assignedName,
      role: isBootstrapAdmin ? 'admin' : assignedRole,
      status: 'active',
    };
  }
}

/**
 * Fetch all users (only accessible by Admin with active Google session).
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  if (!auth.currentUser) {
    return [];
  }
  const usersRef = collection(db, 'users');
  try {
    const snapshot = await getDocs(usersRef);
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
    console.warn('Could not load all users from Firestore:', error);
    return [];
  }
}

/**
 * Role capability helpers for UI permissions
 */
export const ROLE_PERMISSIONS = {
  admin: {
    label: 'مدير النظام (كامل الصلاحيات)',
    badgeColor:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    canManageUsers: true,
    canCreateEstimate: true,
    canEditEstimate: true,
    canDeleteAnyEstimate: true,
    canExport: true,
    canManagePricingCatalog: true,
    description: 'تحكم كامل بالنظام، تعديل وحذف أي مقايسة، وتعيين وتعديل صلاحيات المستخدمين.',
  },
  estimator: {
    label: 'مهندس تسعير (محرر مقايسات)',
    badgeColor:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    canManageUsers: false,
    canCreateEstimate: true,
    canEditEstimate: true,
    canDeleteAnyEstimate: false,
    canExport: true,
    canManagePricingCatalog: true,
    description: 'إنشاء وتعديل المقايسات، حساب الكميات والتكاليف، وتصدير التقارير.',
  },
  viewer: {
    label: 'مشاهد / مراجع (قراءة فقط)',
    badgeColor:
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    canManageUsers: false,
    canCreateEstimate: false,
    canEditEstimate: false,
    canDeleteAnyEstimate: false,
    canExport: true,
    canManagePricingCatalog: false,
    description: 'استعراض بنود المقايسات، تدقيق الحسابات، وتصدير التقارير فقط دون حق التعديل أو الحذف.',
  },
} as const;

/**
 * Save or update project in Firestore using setDoc with merge.
 * Skips cloud write cleanly if user is in local Email+Password mode without Firebase Auth session.
 */
export async function saveCloudProject(project: CloudProject, user: UserProfile): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  const fbUid = auth.currentUser.uid;
  const safeId = (project.id || `p${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const projectRef = doc(db, 'projects', safeId);
  const path = `projects/${safeId}`;

  const effectiveOwnerId =
    project.ownerId && !project.ownerId.startsWith('u_') && user.role === 'admin'
      ? project.ownerId
      : fbUid;

  const rawLogo = project.logoDataUrl || '';
  const safeLogo = rawLogo.length <= 500000 ? rawLogo : '';
  const safeEstimate = Array.isArray(project.estimate) ? project.estimate.slice(0, 5000) : [];
  const rawDiscount = Number(project.discountPercent) || 0;
  const safeDiscount = Math.min(100, Math.max(0, rawDiscount));

  try {
    const nowIso = new Date().toISOString();
    const docData: CloudProject = {
      id: safeId,
      ownerId: effectiveOwnerId.slice(0, 128),
      ownerEmail: (project.ownerEmail || auth.currentUser.email || user.email || '').slice(0, 128),
      projectName: (project.projectName || 'مقايسة بدون اسم').slice(0, 200),
      clientName: (project.clientName || '').slice(0, 200),
      orgName: (project.orgName || '').slice(0, 200),
      governorate: (project.governorate || '').slice(0, 100),
      refNumber: (project.refNumber || '').slice(0, 100),
      discountPercent: safeDiscount,
      logoDataUrl: safeLogo,
      estimate: safeEstimate,
      createdAt: (project.createdAt || nowIso).slice(0, 64),
      updatedAt: nowIso.slice(0, 64),
    };

    await setDoc(projectRef, docData, { merge: true });
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.warn('saveCloudProject Firestore notice:', error);
  }
}

/**
 * Fetch projects from Firestore.
 * Returns [] cleanly when in local Email+Password mode without Firebase Auth session.
 */
export async function fetchCloudProjects(
  user: UserProfile,
  viewAllTeam = false
): Promise<CloudProject[]> {
  if (!auth.currentUser) {
    return [];
  }

  try {
    const projectsRef = collection(db, 'projects');
    const q =
      user.role === 'admin' && viewAllTeam
        ? query(projectsRef)
        : query(projectsRef, where('ownerId', '==', auth.currentUser.uid));

    const snapshot = await getDocs(q);
    const list: CloudProject[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as CloudProject);
    });
    return list;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    }
    console.warn('fetchCloudProjects Firestore notice:', error);
    return [];
  }
}

/**
 * Delete project from Firestore.
 */
export async function deleteCloudProject(projectId: string): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `projects/${safeId}`;
  try {
    await deleteDoc(doc(db, 'projects', safeId));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.warn('deleteCloudProject Firestore notice:', error);
  }
}
