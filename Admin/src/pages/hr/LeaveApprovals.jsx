import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, FileText, CheckCircle, XCircle } from 'lucide-react';

const LeaveApprovals = () => {
  const { userData } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'leave_requests')
      );
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      
      const sortedData = data.sort((a, b) => {
        const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
        const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
        return timeB - timeA;
      });
      
      setLeaves(sortedData);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [userData]);

  const handleStatusUpdate = async (leaveId, newStatus, userId) => {
    try {
      await updateDoc(doc(db, 'leave_requests', leaveId), {
        status: newStatus,
        reviewedBy: userData.name || 'HR Manager',
        reviewedAt: new Date().toISOString()
      });
      
      if (userId) {
        const notifTitle = `Leave ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`;
        const notifBody = `Your leave request has been ${newStatus} by HR.`;

        await addDoc(collection(db, 'notifications'), {
          userId: userId,
          title: notifTitle,
          body: notifBody,
          type: 'leave_status',
          isRead: false,
          createdAt: serverTimestamp()
        });

        // Send push notification via proxy (dev: Vite proxy, prod: PHP relay)
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const recipientData = userSnap.data();
            const tokens = [];
            if (recipientData.expoPushToken) tokens.push(recipientData.expoPushToken);
            if (Array.isArray(recipientData.expoPushTokens)) {
              recipientData.expoPushTokens.forEach(t => { if (t && !tokens.includes(t)) tokens.push(t); });
            }
            if (tokens.length > 0) {
              const pushUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '/expo-push' : '/expo-push.php';
              for (const token of tokens) {
                try {
                  const message = {
                    to: token,
                    sound: 'default',
                    title: notifTitle,
                    body: notifBody,
                    data: { type: 'leave_status', status: newStatus },
                    channelId: 'booking_v3'
                  };
                  await fetch(pushUrl, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(message),
                  });
                  console.log(`[Push] Leave status push notification sent successfully to token: ${token}`);
                } catch (tokErr) {
                  console.warn(`[Push] Error sending leave status to token ${token}:`, tokErr);
                }
              }
            }
          }
        } catch (pushErr) {
          console.warn('[Push] Error sending leave status push:', pushErr);
        }
      }
      
      alert(`Leave request ${newStatus} successfully.`);
      fetchLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('Failed to update leave status.');
    }
  };

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Leave Approvals</h2>
          <p style={{ color: 'var(--text-muted)' }}>Review and approve/reject staff leave requests</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>Loading leave requests...</div>
      ) : leaves.length === 0 ? (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No leave requests pending.
        </div>
      ) : (
        <div className="table-container glass-panel">
          <table>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Leave Category</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.staffName}</td>
                  <td><span className="badge badge-secondary">{item.staffRole?.toUpperCase()}</span></td>
                  <td>{item.category || item.leaveType || 'General'}</td>
                  <td>{item.startDate} to {item.endDate}</td>
                  <td>{item.reason}</td>
                  <td>
                    <span className={`badge ${item.status === 'approved' ? 'badge-primary' : item.status === 'rejected' ? 'badge-secondary' : ''}`}>
                      {item.status?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {item.status === 'pending' ? (
                      <div className="flex-gap">
                        <button className="btn-primary" onClick={() => handleStatusUpdate(item.id, 'approved', item.userId)}>
                          Approve
                        </button>
                        <button className="btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleStatusUpdate(item.id, 'rejected', item.userId)}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovals;
