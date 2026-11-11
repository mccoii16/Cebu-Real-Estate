import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Creates an agent user in Firebase Authentication using a secondary Firebase app instance.
 * Using a secondary app prevents the currently logged-in Super Admin from being signed out!
 */
export async function createAgentFirebaseAuthUser(
  email: string,
  pass: string,
  displayName: string
): Promise<{ success: boolean; uid: string; error?: string; isExisting?: boolean }> {
  const secondaryAppName = 'AgentRegistrationApp';
  let secondaryApp = getApps().find((a) => a.name === secondaryAppName);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }

  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await updateProfile(userCredential.user, { displayName });
    const uid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return { success: true, uid };
  } catch (err: any) {
    await signOut(secondaryAuth).catch(() => {});
    console.warn('[AgentAuthService] createUserWithEmailAndPassword error:', err.code, err.message);

    if (err.code === 'auth/email-already-in-use') {
      return { success: true, uid: '', isExisting: true };
    }

    return { success: false, uid: '', error: err.code || err.message };
  }
}
