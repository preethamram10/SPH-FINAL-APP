import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendRemotePushNotification } from './notificationHelper';

/**
 * Creates a notification in the Firestore database and sends a push notification
 * @param {string} userId - The user ID to receive the notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {string} type - Notification type (e.g., 'leave_request', 'leave_status')
 * @param {object} metadata - Additional data
 */
export const createNotification = async (userId, title, body, type, metadata = {}) => {
  try {
    // 1. Write Firestore document
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      message: body,
      type,
      metadata,
      isRead: false,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp()
    });

    // 2. Fetch recipient's push tokens and send remote push notification
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const tokens = [];
        if (u.expoPushToken) tokens.push(u.expoPushToken);
        if (u.pushToken) tokens.push(u.pushToken);
        if (u.fcmToken) tokens.push(u.fcmToken);
        if (Array.isArray(u.expoPushTokens)) {
          u.expoPushTokens.forEach(t => {
            if (t && !tokens.includes(t)) tokens.push(t);
          });
        }
        if (tokens.length > 0) {
          await sendRemotePushNotification(tokens, title, body, { type, ...metadata });
        }
      }
    } catch (tokenErr) {
      console.warn("[Push] Error fetching token for user:", userId, tokenErr);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Sends a notification to all HRs in a specific branch (and pushes to their device)
 */
export const notifyBranchHRs = async (branchId, title, body, type, metadata = {}) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['hr', 'HR', 'Hr', 'hr manager', 'HR Manager', 'hr_manager', 'HR_Manager'])
    );
    const hrSnapshot = await getDocs(q);
    
    await Promise.all(
      hrSnapshot.docs.map(docSnap => 
        createNotification(docSnap.id, title, body, type, metadata)
      )
    );
  } catch (error) {
    console.error('Error notifying HRs:', error);
  }
};

/**
 * Sends a notification to all HR users across all branches (and pushes to their device)
 */
export const notifyAllHRs = async (title, body, type, metadata = {}) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['hr', 'HR', 'Hr', 'admin', 'Admin', 'superadmin', 'Superadmin', 'hr manager', 'HR Manager'])
    );
    const snap = await getDocs(q);
    const pushTokens = new Set();
    const batchNotifs = [];

    snap.forEach(d => {
      const u = d.data();
      if (u.expoPushToken) pushTokens.add(u.expoPushToken);
      if (u.pushToken) pushTokens.add(u.pushToken);
      if (u.fcmToken) pushTokens.add(u.fcmToken);
      if (Array.isArray(u.expoPushTokens)) {
        u.expoPushTokens.forEach(t => { if (t) pushTokens.add(t); });
      }

      batchNotifs.push(
        addDoc(collection(db, 'notifications'), {
          userId: d.id,
          title,
          body,
          message: body,
          type,
          metadata,
          isRead: false,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        })
      );
    });

    batchNotifs.push(
      addDoc(collection(db, 'notifications'), {
        targetRole: 'hr',
        title,
        body,
        message: body,
        type,
        metadata,
        isRead: false,
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      })
    );

    await Promise.all(batchNotifs);

    if (pushTokens.size > 0) {
      sendRemotePushNotification(Array.from(pushTokens), title, body, { type, ...metadata }).catch(err => console.warn("[Push] HR push notification warning:", err));
    }
  } catch (error) {
    console.error('Error notifying all HRs:', error);
  }
};

/**
 * Sends a notification to all Receptionist users across all branches (and pushes to their device)
 */
export const notifyAllReceptionists = async (title, body, type, metadata = {}) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['receptionist', 'Receptionist'])
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map(docSnap => 
        createNotification(docSnap.id, title, body, type, metadata)
      )
    );
  } catch (error) {
    console.error('Error notifying receptionists:', error);
  }
};

/**
 * Sends a notification to Receptionist users of a specific branch
 */
export const notifyBranchReceptionists = async (branchId, title, body, type, metadata = {}) => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const targetNorm = String(branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();

    const matchingUserIds = new Set();
    const pushTokens = new Set();

    snap.forEach(d => {
      const u = d.data();
      const role = String(u.role || '').toLowerCase();
      const isBranchRole = role === 'branch' || role === 'receptionist' || role === 'staff' || role === 'reception';
      
      const uId = d.id;
      const uBranchName = String(u.branchName || u.branch || u.name || u.branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
      const uBranchId = String(u.branchId || '').toLowerCase().trim();

      if (
        isBranchRole && (
          uId === branchId ||
          uId.toLowerCase() === targetNorm ||
          uBranchName === targetNorm ||
          uBranchId === targetNorm
        )
      ) {
        matchingUserIds.add(d.id);
        if (u.expoPushToken) pushTokens.add(u.expoPushToken);
        if (u.pushToken) pushTokens.add(u.pushToken);
        if (u.fcmToken) pushTokens.add(u.fcmToken);
        if (Array.isArray(u.expoPushTokens)) {
          u.expoPushTokens.forEach(t => { if (t) pushTokens.add(t); });
        }
      }
    });

    if (branchId) matchingUserIds.add(branchId);

    // Also write a broadcast notification doc with branchId & targetRole: 'receptionist'
    await addDoc(collection(db, 'notifications'), {
      branchId: branchId,
      userId: branchId,
      targetRole: 'receptionist',
      title,
      body,
      message: body,
      type,
      metadata,
      isRead: false,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp()
    });

    if (pushTokens.size > 0) {
      await sendRemotePushNotification(Array.from(pushTokens), title, body, { type, ...metadata });
    }

    await Promise.all(
      Array.from(matchingUserIds).map(uid => 
        createNotification(uid, title, body, type, metadata)
      )
    );
  } catch (error) {
    console.error('Error notifying branch receptionists:', error);
  }
};

