import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, updateDoc, doc, where, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, DollarSign, History, Shield, RefreshCw } from 'lucide-react';

const MedicineDiscounts = () => {
  const { userData } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('pending'); // 'pending' or 'history'

  const sendPushToUser = async (userId, title, body, metadata = {}) => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const u = docSnap.data();
        const tokens = [];
        if (u.expoPushToken) tokens.push(u.expoPushToken);
        if (Array.isArray(u.expoPushTokens)) {
          u.expoPushTokens.forEach(t => {
            if (t && !tokens.includes(t)) tokens.push(t);
          });
        }

        if (tokens.length > 0) {
          const pushUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '/expo-push' : '/expo-push.php';
          for (const token of tokens) {
            try {
              const message = {
                to: token,
                sound: 'default',
                title,
                body,
                data: metadata,
                priority: 'high'
              };
              await fetch(pushUrl, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Accept-encoding': 'gzip, deflate',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
              });
              console.log(`[sendPushToUser] Sent to token ${token}`);
            } catch (tokErr) {
              console.warn(`[sendPushToUser] Error sending to token ${token}:`, tokErr);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error sending push to user:', userId, e);
    }
  };

  const sendPushToRole = async (role, title, body, metadata = {}) => {
    try {
      const targetRoles = role === 'receptionist'
        ? ['receptionist', 'Receptionist', 'RECEPTIONIST']
        : role === 'hr'
        ? ['hr', 'HR', 'Hr']
        : [role];

      const q = query(collection(db, 'users'), where('role', 'in', targetRoles));
      const snap = await getDocs(q);
      const tokens = [];
      snap.forEach(docSnap => {
        const u = docSnap.data();
        if (u.expoPushToken) tokens.push(u.expoPushToken);
        if (Array.isArray(u.expoPushTokens)) {
          u.expoPushTokens.forEach(t => {
            if (t && !tokens.includes(t)) tokens.push(t);
          });
        }
      });

      if (tokens.length > 0) {
        const pushUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '/expo-push' : '/expo-push.php';
        for (const token of tokens) {
          try {
            const message = {
              to: token,
              sound: 'default',
              title,
              body,
              data: metadata,
              priority: 'high'
            };
            await fetch(pushUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(message)
            });
            console.log(`[sendPushToRole] Sent to token ${token}`);
          } catch (tokErr) {
            console.warn(`[sendPushToRole] Error sending to token ${token}:`, tokErr);
          }
        }
      }
    } catch (e) {
      console.error('Error sending push to role:', role, e);
    }
  };

  const notifyUserFirestore = async (userId, title, body, type, metadata = {}) => {
    if (!userId) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        body,
        type,
        metadata,
        isRead: false,
        createdAt: new Date()
      });
    } catch (e) {
      console.error('Error creating Firestore notification:', e);
    }
  };

  const notifyAllRoleFirestore = async (role, title, body, type, metadata = {}) => {
    try {
      const targetRoles = role === 'receptionist'
        ? ['receptionist', 'Receptionist', 'RECEPTIONIST']
        : role === 'hr'
        ? ['hr', 'HR', 'Hr']
        : [role];

      const q = query(collection(db, 'users'), where('role', 'in', targetRoles));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        await addDoc(collection(db, 'notifications'), {
          userId: docSnap.data().uid || docSnap.id,
          title,
          body,
          type,
          metadata,
          isRead: false,
          createdAt: new Date()
        });
      }
    } catch (e) {
      console.error('Error sending Firestore notification to role:', role, e);
    }
  };

  useEffect(() => {
    setLoading(true);

    let latestPatients = [];
    let latestAppts = [];

    const updateCombined = () => {
      const combined = [];
      const seenIds = new Set();

      latestPatients.forEach(p => {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          combined.push(p);
        }
      });

      latestAppts.forEach(a => {
        if (!seenIds.has(a.id)) {
          seenIds.add(a.id);
          combined.push(a);
        }
      });

      // Sort by updatedAt descending
      combined.sort((a, b) => {
        const timeA = (a.updatedAt && typeof a.updatedAt.toDate === 'function') ? a.updatedAt.toDate() : (a.updatedAt ? new Date(a.updatedAt) : 0);
        const timeB = (b.updatedAt && typeof b.updatedAt.toDate === 'function') ? b.updatedAt.toDate() : (b.updatedAt ? new Date(b.updatedAt) : 0);
        return timeB - timeA;
      });

      setRequests(combined);
      setLoading(false);
    };

    // Listen to unified allpatients collection
    const qPatients = query(
      collection(db, 'allpatients'),
      where('medicineDiscountStatus', 'in', ['pending', 'approved', 'rejected'])
    );
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.medicineDiscountStatus) {
          list.push({
            id: docSnap.id,
            firestoreCollection: 'allpatients',
            ...data
          });
        }
      });
      latestPatients = list;
      updateCombined();
    }, (error) => {
      console.error('Error listening to medicine discount patients:', error);
      setLoading(false);
    });

    // Listen to appointments collection as well for safety/parity
    const qAppts = query(
      collection(db, 'appointments'),
      where('medicineDiscountStatus', 'in', ['pending', 'approved', 'rejected'])
    );
    const unsubscribeAppts = onSnapshot(qAppts, (appSnap) => {
      const list = [];
      appSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.medicineDiscountStatus) {
          list.push({
            id: docSnap.id,
            firestoreCollection: 'appointments',
            ...data
          });
        }
      });
      latestAppts = list;
      updateCombined();
    }, (error) => {
      console.error('Error listening to medicine discount appts:', error);
    });

    return () => {
      unsubscribePatients();
      unsubscribeAppts();
    };
  }, []);

  const handleStatusUpdate = async (request, newStatus) => {
    try {
      const collectionName = request.firestoreCollection || (request._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, request.id);
      const isConsult = request.medicineDiscountType === 'consultation';

      if (newStatus === 'approved') {
        await updateDoc(docRef, {
          ...(isConsult ? { consultationFee: Number(request.medicineDiscountRequested) } : { medicineFeeRequested: Number(request.medicineDiscountRequested) }),
          medicineDiscountStatus: 'approved',
          updatedAt: new Date()
        });
      } else {
        await updateDoc(docRef, {
          medicineDiscountStatus: 'rejected',
          updatedAt: new Date()
        });
      }

      try {
        const discountName = isConsult ? 'Consultation' : 'Medicine';
        const notifTitle = newStatus === 'approved' ? `✓ ${discountName} Discount Approved` : `✕ ${discountName} Discount Rejected`;
        const notifBody = newStatus === 'approved'
          ? `${discountName} discount request for ${request.fullName || 'Patient'} was approved! New Amount: ₹${request.medicineDiscountRequested}.`
          : `${discountName} discount request for ${request.fullName || 'Patient'} was rejected. Fee remains ₹${request.medicineDiscountOriginal || (isConsult ? request.consultationFee : request.medicineFeeRequested)}.`;

        if (request.medicineDiscountRequestedBy) {
          await sendPushToUser(request.medicineDiscountRequestedBy, notifTitle, notifBody, { type: `medicine_discount_${newStatus}`, patientId: request.id });
          await notifyUserFirestore(request.medicineDiscountRequestedBy, notifTitle, notifBody, `medicine_discount_${newStatus}`, { patientId: request.id });
        } else {
          await sendPushToRole('receptionist', notifTitle, notifBody, { type: `medicine_discount_${newStatus}`, patientId: request.id });
          await notifyAllRoleFirestore('receptionist', notifTitle, notifBody, `medicine_discount_${newStatus}`, { patientId: request.id });
        }
      } catch (pushErr) {
        console.warn('Failed to send push/notification to receptionists:', pushErr);
      }

      alert(`${isConsult ? 'Consultation' : 'Medicine'} discount request ${newStatus} successfully.`);
    } catch (error) {
      console.error('Error updating discount request:', error);
      alert('Failed to update request: ' + error.message);
    }
  };

  const pendingRequests = requests.filter(r => r.medicineDiscountStatus === 'pending');
  const historyRequests = requests.filter(r => r.medicineDiscountStatus !== 'pending');

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Fee Discount Approvals</h2>
          <p style={{ color: 'var(--text-muted)' }}>Review receptionist requests to modify consultation or medicine billing amounts for patients</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <button
          onClick={() => setSubTab('pending')}
          className={`btn-secondary ${subTab === 'pending' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: subTab === 'pending' ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
            color: subTab === 'pending' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          <DollarSign size={14} /> Pending Requests
          {pendingRequests.length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              borderRadius: '10px',
              padding: '1px 6px',
              fontSize: '11px',
              fontWeight: 700,
              marginLeft: '4px'
            }}>
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`btn-secondary ${subTab === 'history' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: subTab === 'history' ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
            color: subTab === 'history' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          <History size={14} /> History Log
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
          <div>Loading discount requests...</div>
        </div>
      ) : (subTab === 'pending' ? pendingRequests : historyRequests).length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          📭 No discount requests found in this tab.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {(subTab === 'pending' ? pendingRequests : historyRequests).map((req) => (
            <div
              key={req.id}
              className="glass-panel"
              style={{
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid ${req.medicineDiscountStatus === 'pending' ? '#fbbf24' : req.medicineDiscountStatus === 'approved' ? '#10b981' : '#ef4444'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-main)' }}>{req.fullName}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Branch: {req.branchName || 'N/A'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Doctor: {req.doctor || req.doctorName || 'N/A'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                    Type: {req.medicineDiscountType === 'consultation' ? 'Consultation Fee' : 'Medicine Fee'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    backgroundColor: req.medicineDiscountStatus === 'pending' ? 'rgba(251,191,36,0.1)' : req.medicineDiscountStatus === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: req.medicineDiscountStatus === 'pending' ? '#fbbf24' : req.medicineDiscountStatus === 'approved' ? '#10b981' : '#ef4444'
                  }}
                >
                  {req.medicineDiscountStatus}
                </span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Original Amount:</span>
                  <span style={{ textDecoration: 'line-through', fontWeight: '600' }}>₹{req.medicineDiscountOriginal || (req.medicineDiscountType === 'consultation' ? req.consultationFee : req.medicineFeeRequested)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>Requested Amount:</span>
                  <span style={{ color: '#10b981', fontWeight: '800', fontSize: '15px' }}>₹{req.medicineDiscountRequested}</span>
                </div>
                {req.medicineDiscountNote && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Note: "{req.medicineDiscountNote}"
                  </div>
                )}
              </div>

              {req.medicineDiscountStatus === 'pending' && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handleStatusUpdate(req, 'rejected')}
                    className="btn-secondary"
                    style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', cursor: 'pointer' }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(req, 'approved')}
                    className="btn-primary"
                    style={{ flex: 1, backgroundColor: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', cursor: 'pointer' }}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicineDiscounts;
