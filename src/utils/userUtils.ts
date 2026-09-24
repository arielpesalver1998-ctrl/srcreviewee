import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { initFirebaseClient } from './firebaseClient';
import { normalizeEmail } from './stringUtils';
import { resolveAuthenticatedAccount } from '../services/accountResolver';

import { withTimeout } from './firebaseClient';

export { normalizeEmail };

export const ensureUserDocument = async (firebaseUser: User) => {
  if (!firebaseUser?.uid) return null;

  try {
    const resolution = await withTimeout(resolveAuthenticatedAccount(firebaseUser), 25000);

    if (resolution.status === 'found') {
      return resolution.account;
    }

    if (resolution.status === 'conflict') {
      throw new Error(resolution.message || "Multiple accounts share this email address. Please contact Admin.");
    }
  } catch (err: any) {
    if (err.message === "Firebase operation timed out") {
       console.warn("[ensureUserDocument] Account resolution timed out, attempting to continue with local data if available...");
    } else {
       throw err;
    }
  }

  // CASE: No existing account found for this UID or email.
  // Create pending user record for ProfileSetup / complete registration.
  const { db } = await initFirebaseClient();
  if (!db) {
    throw new Error("Firestore database is not initialized.");
  }

  const authUid = firebaseUser.uid;
  const cleanEmail = normalizeEmail(firebaseUser.email);
  const displayName = firebaseUser.displayName || "";
  const emailName = cleanEmail ? cleanEmail.split("@")[0] : "Reviewee";

  let parsedFirst = "";
  let parsedMiddle = "";
  let parsedLast = "";

  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) {
      parsedFirst = parts[0];
    } else if (parts.length === 2) {
      parsedFirst = parts[0];
      parsedLast = parts[1];
    } else if (parts.length === 3) {
      parsedFirst = parts[0];
      parsedMiddle = parts[1];
      parsedLast = parts[2];
    } else if (parts.length >= 4) {
      parsedFirst = parts.slice(0, parts.length - 2).join(" ");
      parsedMiddle = parts[parts.length - 2];
      parsedLast = parts[parts.length - 1];
    }
  }

  const isGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');

  const authUserRef = doc(db, "users", authUid);
  const initialProfile = {
    uid: authUid,
    authUid,
    firebaseUid: authUid,
    email: cleanEmail,
    email_lower: cleanEmail,
    normalizedEmail: cleanEmail,
    displayName: displayName || emailName,
    firstName: parsedFirst,
    first_name: parsedFirst.toUpperCase(),
    middleName: parsedMiddle,
    middle_name: parsedMiddle.toUpperCase(),
    lastName: parsedLast,
    last_name: parsedLast.toUpperCase(),
    role: "Reviewee",
    status: "pending_profile",
    accountStatus: "pending_profile",
    googleLinked: isGoogle ? true : false,
    googleProvider: isGoogle ? true : false,
    registrationMethod: isGoogle ? "google" : "manual",
    authProvider: isGoogle ? "google" : "password",
    profileCompleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    source: "auto-created-login"
  };

  try {
    await withTimeout(setDoc(authUserRef, initialProfile, { merge: true }), 10000);
  } catch (err) {
    console.error("[ensureUserDocument] Failed to create/update user document:", err);
    throw new Error("Unable to initialize your profile. Please check your connection.");
  }

  try {
    const snap = await withTimeout(getDoc(authUserRef), 8000);
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    // If it's just a timeout on reading back, but we just wrote it, we can return the local version
    console.warn("[ensureUserDocument] Timed out reading back user document, returning local version...");
    return { id: authUid, ...initialProfile };
  }
};
