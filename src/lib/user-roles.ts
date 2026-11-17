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
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';

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

  if (isSuperAdmin) {
    let inv: Invitation | undefined = undefined;
    try {
      const snap = await getDoc(doc(db, 'invitations', key));
      if (snap.exists()) {
        inv = snap.data() as Invitation;
      }
    } catch (e) {
      /* ignore */
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

    displayName = inv.displayName || displayName;
    role = inv.role || 'estimator';

    // Generate cryptographic salt and hash
    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const passwordHash = await hashPassword(pass, salt);
    const nowIso = new Date().toISOString();

    await updateDoc(doc(db, 'invitations', key), {
      passwordHash,
      salt,
      status: 'active',
      updatedAt: nowIso,
    });
  } else {
    role = 'admin';
    displayName = 'المدير العام (محمود كوتلي)';
    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const passwordHash = await hashPassword(pass, salt);
    const nowIso = new Date().toISOString();
    try {
      await setDoc(doc(db, 'invitations', key), {
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
    } catch (e) {
      console.warn('Admin invitation setDoc notice:', e);
    }
  }

  const customUid = `u_${key}`;
  const nowIso = new Date().toISOString();
  const profile: UserProfile = {
    uid: customUid,
    email: normEmail,
    displayName,
    role,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'users', customUid), profile);
    if (role === 'admin') {
      await setDoc(doc(db, 'admins', customUid), {
        uid: customUid,
        email: normEmail,
        createdAt: nowIso,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('User profile setDoc notice:', e);
  }

  const customUser = {
    uid: customUid,
    email: normEmail,
    displayName,
    photoURL: null,
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
        `كلمة المرور غير صحيحة لحساب المدير العام (${BOOTSTRAP_ADMIN_EMAIL}). يمكنك استخدام زر Google للدخول المباشر، أو الضغط على (تحديث كلمة المرور) لاختيار كلمة مرور جديدة فوراً.`
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
    throw new Error('كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة أو الضغط على (نسيت كلمة المرور؟).');
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

/**
 * Admin resets an engineer's password, requiring them to set a new password on next login
 */
export async function resetUserPassword(email: string): Promise<void> {
  const key = normalizeEmailKey(email);
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, 'invitations', key), {
    status: 'pending',
    passwordHash: '',
    salt: '',
    updatedAt: nowIso,
  });
}

/**
 * Admin pre-authorizes an email and assigns its role
 */
export async function preAuthorizeUser(
  email: string,
  displayName: string,
  role: UserRole
): Promise<Invitation> {
  const normEmail = email.trim().toLowerCase();
  const key = normalizeEmailKey(normEmail);
  const nowIso = new Date().toISOString();

  const invitation: Invitation = {
    id: key,
    email: normEmail,
    displayName: displayName.trim() || normEmail.split('@')[0],
    role,
    status: 'pending',
    invitedBy: BOOTSTRAP_ADMIN_EMAIL,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(doc(db, 'invitations', key), invitation);
  return invitation;
}

/**
 * Fetch all invitations for the Admin Console
 */
export async function getAllInvitations(): Promise<Invitation[]> {
  const invitationsRef = collection(db, 'invitations');
  try {
    const snapshot = await getDocs(invitationsRef);
    const list: Invitation[] = [];
    snapshot.forEach((snap) => {
      list.push(snap.data() as Invitation);
    });
    return list;
  } catch (err) {
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
  const key = normalizeEmailKey(email);
  const nowIso = new Date().toISOString();

  try {
    await updateDoc(doc(db, 'invitations', key), {
      role: newRole,
      updatedAt: nowIso,
    });
  } catch (e) {
    console.warn('Invitation role update notice:', e);
  }

  if (targetUid) {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        role: newRole,
        updatedAt: nowIso,
      });

      const adminRef = doc(db, 'admins', targetUid);
      if (newRole === 'admin') {
        await setDoc(adminRef, {
          uid: targetUid,
          email,
          createdAt: nowIso,
        });
      } else {
        await deleteDoc(adminRef).catch(() => {});
      }
    } catch (e) {
      console.warn('User doc role update notice:', e);
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
  const key = normalizeEmailKey(email);
  const nowIso = new Date().toISOString();
  const newStatus: AccountStatus = suspend ? 'suspended' : 'active';

  try {
    await updateDoc(doc(db, 'invitations', key), {
      status: newStatus,
      updatedAt: nowIso,
    });
  } catch (e) {
    console.warn('Invitation suspension update notice:', e);
  }

  if (targetUid) {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        status: newStatus,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('User suspension update notice:', e);
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
  const key = normalizeEmailKey(email);

  try {
    await deleteDoc(doc(db, 'invitations', key));
  } catch (e) {
    console.warn('Invitation deletion notice:', e);
  }

  if (targetUid) {
    try {
      await deleteDoc(doc(db, 'users', targetUid));
      await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
    } catch (e) {
      console.warn('User deletion notice:', e);
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
      const key = normalizeEmailKey(normEmail);
      updateDoc(doc(db, 'invitations', key), {
        status: 'active',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
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
      return data;
    } else {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: normEmail,
        displayName: assignedName,
        role: assignedRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);

      if (assignedRole === 'admin') {
        await setDoc(doc(db, 'admins', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: normEmail,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
      return newProfile;
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
 * Fetch all users (only accessible by Admin).
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  try {
    const snapshot = await getDocs(usersRef);
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error) {
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
    badgeColor: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
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
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
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
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
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
 */
export async function saveCloudProject(project: CloudProject, user: UserProfile): Promise<void> {
  const projectRef = doc(db, 'projects', project.id);
  const path = `projects/${project.id}`;

  try {
    const nowIso = new Date().toISOString();
    const docData: CloudProject = {
      id: project.id,
      ownerId: project.ownerId || user.uid,
      ownerEmail: project.ownerEmail || user.email || '',
      projectName: project.projectName || 'مقايسة بدون اسم',
      clientName: project.clientName || '',
      orgName: project.orgName || '',
      governorate: project.governorate || '',
      refNumber: project.refNumber || '',
      discountPercent: Number(project.discountPercent) || 0,
      logoDataUrl: project.logoDataUrl || '',
      estimate: project.estimate || [],
      createdAt: project.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(projectRef, docData, { merge: true });
  } catch (error) {
    console.warn('saveCloudProject Firestore notice:', error);
  }
}

/**
 * Fetch projects from Firestore.
 */
export async function fetchCloudProjects(user: UserProfile, viewAllTeam = false): Promise<CloudProject[]> {
  try {
    const projectsRef = collection(db, 'projects');
    let q;
    if (user.role === 'admin' && viewAllTeam) {
      q = query(projectsRef);
    } else {
      q = query(projectsRef, where('ownerId', '==', user.uid));
    }
    const snapshot = await getDocs(q);
    const list: CloudProject[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as CloudProject);
    });
    return list;
  } catch (error) {
    console.warn('fetchCloudProjects Firestore notice:', error);
    return [];
  }
}

/**
 * Delete project from Firestore.
 */
export async function deleteCloudProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    console.warn('deleteCloudProject Firestore notice:', error);
  }
}
