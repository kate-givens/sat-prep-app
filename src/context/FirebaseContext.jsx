import React, { useState, useEffect, useMemo, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ALL_SKILLS, SAT_STRUCTURE } from '../data/satData';
import { FIREBASE_CONFIG, APP_ID } from '../config/constants';

const FirebaseContext = React.createContext();

// Helper for formatted date
const getFormattedDate = () => new Date().toISOString().split('T')[0];

export const FirebaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Placeholder for environment variable if used in other environments
  const initialAuthToken = null;

  // ✅ Single canonical profile doc ref (ONLY /profile/data)
  const profileDocRef = (uid) => {
    if (!db || !uid) return null;
    return doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data');
  };

  useEffect(() => {
    const app = initializeApp(FIREBASE_CONFIG);
    const firestore = getFirestore(app);
    const firebaseAuth = getAuth(app);
    setDb(firestore);
    setAuth(firebaseAuth);

    const initAuth = async () => {
      // If you ever want to support custom tokens, wire that up here
      if (initialAuthToken) {
        await signInWithCustomToken(firebaseAuth, initialAuthToken);
      }
      // No more anonymous sign-in / demo mode
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // ✅ guard auth too (we reference auth.currentUser below)
    if (!db || !auth || !userId) return;

    const userDocRef = profileDocRef(userId);
    if (!userDocRef) return;

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      const profile = docSnap.exists() ? docSnap.data() : null;

      if (profile) {
        setUserProfile(profile);
        return;
      }

      // Initialize a fresh profile for a new real user
      const initialMastery = ALL_SKILLS.map((skill) => ({
        skillId: skill.skillId,
        masteryLevel: 0,
      }));

      const initialProfile = {
        uid: userId,
        email: auth.currentUser?.email || null,
        firstName: '',
        createdAt: serverTimestamp(),
        hasTakenDiagnostic: false,
        skillMastery: initialMastery.reduce((acc, cur) => {
          acc[cur.skillId] = cur.masteryLevel;
          return acc;
        }, {}),
        dailyProgress: {
          date: getFormattedDate(),
          completed: false,
          score: 0,
        },
      };

      setDoc(userDocRef, initialProfile).catch((e) =>
        console.error('Error setting initial profile:', e)
      );
    });

    return () => unsubscribe();
  }, [db, auth, userId]);

  const updateMastery = async (skillId, isCorrect, difficulty, timeTaken) => {
    if (!db || !userId || !userProfile) return { delta: 0 };

    const isMath = skillId.startsWith('M_');
    const targetTime = isMath ? 90 : 60;

    // Only Medium questions are used for fluency / time penalties
    const isFluencyCheck = difficulty === 'Medium';
    const isSlow = isFluencyCheck && timeTaken > targetTime;

    let delta = 0;

    if (isCorrect) {
      // Positive movement only
      if (difficulty === 'Hard') delta = 12;
      else if (difficulty === 'Medium') delta = 8;
      else delta = 4;

      // Time penalty applies ONLY to Medium questions
      if (isSlow && difficulty === 'Medium') {
        delta = Math.floor(delta * 0.8); // e.g., 8 → 6
      }
    } else {
      // No mastery loss on incorrect answers
      delta = 0;
    }

    const currentMastery = userProfile.skillMastery[skillId] || 0;
    const newMastery = Math.max(0, Math.min(100, currentMastery + delta));

    // Optimistic UI update
    setUserProfile((prev) => ({
      ...prev,
      skillMastery: { ...prev.skillMastery, [skillId]: newMastery },
    }));

    try {
      const ref = profileDocRef(userId);
      if (!ref) return { delta: 0, isSlow: false };

      await updateDoc(ref, {
        [`skillMastery.${skillId}`]: newMastery,
        lastPracticed: new Date(),
      });
      return { delta, isSlow };
    } catch (e) {
      console.error('Error updating mastery:', e);
      return { delta: 0, isSlow: false };
    }
  };

  // (Leaving this helper in case something else uses it; safe to delete if unused)
  const updateSkillMastery = async (skillId, delta, isSlow) => {
    const currentMastery =
      (userProfile &&
        userProfile.skillMastery &&
        userProfile.skillMastery[skillId]) ||
      0;

    const newMastery = Math.max(0, Math.min(100, currentMastery + delta));

    // Optimistic UI update
    setUserProfile((prev) => ({
      ...prev,
      skillMastery: { ...prev.skillMastery, [skillId]: newMastery },
    }));

    try {
      const ref = profileDocRef(userId);
      if (!ref) return { delta: 0, isSlow: false };

      await updateDoc(ref, {
        [`skillMastery.${skillId}`]: newMastery,
        lastPracticed: new Date(),
      });
      return { delta, isSlow };
    } catch (e) {
      console.error('Error updating mastery:', e);
      return { delta: 0, isSlow: false };
    }
  };

  const completeDailyGoal = async (scorePercentage) => {
    if (!db || !userId) return;

    if (scorePercentage >= 60) {
      try {
        const ref = profileDocRef(userId);
        if (!ref) return;

        await updateDoc(ref, {
          dailyProgress: {
            date: getFormattedDate(),
            completed: true,
            score: scorePercentage,
          },
        });
      } catch (e) {
        console.error('Error completing daily goal:', e);
      }
    }
  };

  const resetAccount = async () => {
    if (!db || !userId) return;

    if (
      window.confirm(
        'Are you sure? This will wipe your progress and start you from zero.'
      )
    ) {
      try {
        const ref = profileDocRef(userId);
        if (!ref) return;

        await deleteDoc(ref);
        setUserProfile(null);
        window.location.reload();
      } catch (e) {
        console.error('Reset failed', e);
      }
    }
  };

  const loginWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signupWithEmail = async (email, password, firstName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // ✅ Write profile fields to ONLY /profile/data
    if (db) {
      const ref = profileDocRef(cred.user.uid);
      if (ref) {
        await setDoc(
          ref,
          {
            uid: cred.user.uid,
            email: cred.user.email || email,
            firstName: firstName || '',
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    return cred;
  };

  const logout = () => signOut(auth);

  const value = useMemo(
    () => ({
      db,
      auth,
      userId,
      isAuthReady,
      userProfile,
      setUserProfile,
      SKILLS: ALL_SKILLS,
      SAT_STRUCTURE,
      loginWithEmail,
      signupWithEmail,
      logout,
      resetAccount,
      updateMastery,
      completeDailyGoal,
    }),
    [db, auth, userId, isAuthReady, userProfile]
  );

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);
