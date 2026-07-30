import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, auth, db } from './firebase';
import type { Firestore } from 'firebase/firestore';

const messaging = app ? getMessaging(app) : null;

export const requestNotificationPermission = async () => {
  if (!messaging || !auth || !db) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BPr7s3P1s8mO8s7V1u1b-j_k-l_M8o6s9N2k8e9S8o7n6s6a5s4v3w2x1y0z89a7b6c5d4e3f2g1h', // Placeholder - should be configured in Firebase console
      });
      if (token) {
        const user = auth.currentUser;
        if (user) {
          await setDoc(doc(db as Firestore, 'users', user.uid, 'fcmTokens', token), {
            token,
            createdAt: serverTimestamp(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
