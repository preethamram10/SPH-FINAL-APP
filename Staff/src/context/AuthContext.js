import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, getDocFromCache, getDocsFromCache } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { registerForPushNotificationsAsync } from '../utils/notificationHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
const AuthContext = createContext({});
const HOSPITAL_ID = 'sph-main';
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(auth.currentUser || null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Ultra-fast instant cache hydration on app boot
  useEffect(() => {
    AsyncStorage.getItem('staff_user_data_cache').then(cachedStr => {
      if (cachedStr) {
        try {
          const parsed = JSON.parse(cachedStr);
          if (parsed && parsed.id) {
            setUserData(parsed);
          }
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          let bestMatch = null;
          let phoneToMatch = null;
          if (currentUser.phoneNumber) {
            phoneToMatch = currentUser.phoneNumber.replace('+91', '').trim();
          } else if (currentUser.email && currentUser.email.startsWith('dummyphone_')) {
            phoneToMatch = currentUser.email.replace('dummyphone_', '').replace('@sph.com', '').trim();
          }
          const staffRoles = ['receptionist', 'reception', 'receptionist_admin', 'doctor', 'staff', 'hr', 'branch', 'admin'];
          const cachedDocId = await AsyncStorage.getItem('staff_user_doc_id');

          let candidateDocs = [];
          const promises = [];

          const runDocsQuery = async (q) => {
            try {
              return await getDocs(q);
            } catch (offlineErr) {
              try {
                return await getDocsFromCache(q);
              } catch (cacheErr) {
                return { empty: true, forEach: () => { } };
              }
            }
          };

          // 1. Try querying by uid field
          const p2 = runDocsQuery(query(collection(db, 'users'), where('uid', '==', currentUser.uid)))
            .then(snapUid => {
              snapUid.forEach(d => {
                candidateDocs.push({ id: d.id, ...d.data() });
              });
            })
            .catch(e => console.log('Error querying by uid field:', e));
          promises.push(p2);

          // 2. Try phone number matches (only if user logged in with phone/OTP)
          if (phoneToMatch) {
            const clean10 = phoneToMatch.replace(/\D/g, '').slice(-10);
            const phoneNum = parseInt(clean10, 10);
            const p3 = runDocsQuery(query(collection(db, 'users'), where('phone', '==', phoneNum)))
              .then(snapPhone => { snapPhone.forEach(d => candidateDocs.push({ id: d.id, ...d.data() })); })
              .catch(e => console.log('Error querying by phone int:', e));
            promises.push(p3);

            const p4 = runDocsQuery(query(collection(db, 'users'), where('phone', '==', clean10)))
              .then(snapPhone => { snapPhone.forEach(d => candidateDocs.push({ id: d.id, ...d.data() })); })
              .catch(e => console.log('Error querying by phone str:', e));
            promises.push(p4);

            const p4b = runDocsQuery(query(collection(db, 'users'), where('phone', '==', '+91' + clean10)))
              .then(snapPhone => { snapPhone.forEach(d => candidateDocs.push({ id: d.id, ...d.data() })); })
              .catch(e => console.log('Error querying by phone +91:', e));
            promises.push(p4b);

            const p4c = runDocsQuery(query(collection(db, 'users'), where('phone', '==', '91' + clean10)))
              .then(snapPhone => { snapPhone.forEach(d => candidateDocs.push({ id: d.id, ...d.data() })); })
              .catch(e => console.log('Error querying by phone 91:', e));
            promises.push(p4c);
          }
          // Try email matches (only if user logged in with email/password)
          else if (currentUser.email && !currentUser.email.startsWith('dummyphone_')) {
            const emailToUse = currentUser.email.toLowerCase().trim();
            const p5 = runDocsQuery(query(collection(db, 'users'), where('email', '==', emailToUse)))
              .then(snapEmail => {
                snapEmail.forEach(d => {
                  candidateDocs.push({ id: d.id, ...d.data() });
                });
              })
              .catch(e => console.log('Error querying by email:', e));
            promises.push(p5);
          }

          // Await lookup queries in parallel
          await Promise.all(promises);

          // Deduplicate candidate documents by Firestore document ID
          const uniqueCandidatesMap = {};
          candidateDocs.forEach(doc => {
            uniqueCandidatesMap[doc.id] = doc;
          });
          const uniqueCandidates = Object.values(uniqueCandidatesMap);

          const targetCleanPhone = phoneToMatch ? phoneToMatch.replace(/\D/g, '').slice(-10) : '';

          // Priority 1: Specifically look for a Receptionist/Branch staff profile matching target phone
          bestMatch = uniqueCandidates.find(d => {
            const docCleanPhone = String(d.phone || '').replace(/\D/g, '').slice(-10);
            const isActive = d.status === 'active' || !d.status;
            const phoneMatches = !targetCleanPhone || (docCleanPhone.length === 10 && docCleanPhone === targetCleanPhone);
            const r = String(d.role || '').toLowerCase().trim();
            const isReceptionist = r.includes('reception') || r.includes('branch');
            return isActive && phoneMatches && isReceptionist;
          });

          // Priority 2: Look for any valid non-patient staff document
          if (!bestMatch) {
            bestMatch = uniqueCandidates.find(d => {
              const docCleanPhone = String(d.phone || '').replace(/\D/g, '').slice(-10);
              const isActive = d.status === 'active' || !d.status;
              const phoneMatches = !targetCleanPhone || (docCleanPhone.length === 10 && docCleanPhone === targetCleanPhone);
              const r = String(d.role || '').toLowerCase().trim();
              const isStaffRole = r !== 'patient' && r !== 'user' && r !== '';
              return isActive && phoneMatches && isStaffRole;
            });
          }

          // Priority 3: Fallback to cached document ID if present
          if (!bestMatch && cachedDocId) {
            try {
              const docSnap = await getDoc(doc(db, 'users', cachedDocId));
              if (docSnap && docSnap.exists()) {
                const data = docSnap.data();
                const roleLower = String(data.role || '').toLowerCase().trim();
                if (roleLower !== 'patient' && roleLower !== 'user' && roleLower !== '') {
                  bestMatch = { id: docSnap.id, ...data };
                }
              }
            } catch (e) {}
          }

          if (bestMatch) {
            const cleanPhoneStr = String(bestMatch.phone || '').replace(/\D/g, '').slice(-10);

            // Explicitly assign and self-heal 9132176176 as official Nallagandla Receptionist
            if (cleanPhoneStr === '9132176176' || currentUser.phoneNumber?.includes('9132176176')) {
              bestMatch.role = 'receptionist';
              bestMatch.branchName = 'Nallagandla';
              bestMatch.branchId = 'Nallagandla';
              try {
                await updateDoc(doc(db, 'users', bestMatch.id), {
                  role: 'receptionist',
                  branchName: 'Nallagandla',
                  branchId: 'Nallagandla'
                });
              } catch (err) {
                console.warn("Could not update Nallagandla receptionist doc in Firestore:", err);
              }
            } else {
              const rawRole = String(bestMatch.role || '').toLowerCase().trim();
              if (rawRole === 'staff' || rawRole === 'reception' || rawRole === 'branch' || rawRole === '') {
                bestMatch.role = 'receptionist';
              } else {
                bestMatch.role = rawRole;
              }
            }

            // Cache the document ID and full user data for instant future app boots
            await AsyncStorage.setItem('staff_user_doc_id', bestMatch.id);
            await AsyncStorage.setItem('staff_user_data_cache', JSON.stringify(bestMatch));

            // Self-healing: associate authenticated UID field if missing or mismatched
            if (!bestMatch.uid || bestMatch.uid !== currentUser.uid) {
              try {
                await updateDoc(doc(db, 'users', bestMatch.id), { uid: currentUser.uid });
                bestMatch.uid = currentUser.uid;
              } catch (err) {
                console.warn("Could not associate UID with user doc:", err);
              }
            }

            // Set the userData and unblock the app loading screen immediately!
            setUserData(bestMatch);
            setLoading(false);

            // Register push notifications asynchronously in the background
            registerForPushNotificationsAsync()
              .then(async (token) => {
                if (token) {
                  // Deduplicate: remove this token from any other user documents
                  try {
                    const qOther = query(
                      collection(db, 'users'),
                      where('expoPushToken', '==', token)
                    );
                    const snapOther = await getDocs(qOther);
                    for (const d of snapOther.docs) {
                      if (d.id !== bestMatch.id) {
                        await updateDoc(doc(db, 'users', d.id), {
                          expoPushToken: null,
                          expoPushTokens: arrayRemove(token)
                        });
                      }
                    }
                  } catch (dedupErr) {
                    console.warn("[AuthContext] Token deduplication warning:", dedupErr);
                  }

                  // Save to current user
                  await updateDoc(doc(db, 'users', bestMatch.id), {
                    expoPushToken: token,
                    expoPushTokens: arrayUnion(token)
                  });
                  console.log("[AuthContext] Saved staff push token to Firestore:", token);
                }
              })
              .catch((tokenErr) => {
                console.warn("[AuthContext] Could not store staff push token:", tokenErr);
              });

            return; // Exit early to avoid setting loading to false again
          } else {
            setUserData(prev => prev || null);
          }
        } catch (error) {
          console.error("Error fetching staff data:", error);
          setUserData(prev => prev || null);
        }
      } else {
        setUserData(null);
        await AsyncStorage.removeItem('staff_user_doc_id').catch(() => { });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);