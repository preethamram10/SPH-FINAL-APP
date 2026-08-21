const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/Dashboard.js";
let content = fs.readFileSync(file, 'utf8');

const targetBlock =   const fetchMonthlyTarget = React.useCallback(() => {
    if (!userData?.branchId || userData?.role !== 'receptionist') return;

    try {
      const today = new Date();
      const monthKey = \\-\\;

      const targetsRef = collection(db, 'monthly_targets');
      const qTarget = query(targetsRef, where('month', '==', monthKey), where('branchId', '==', userData.branchId));

      const unsubscribeTarget = onSnapshot(qTarget, (snapshot) => {
        if (!snapshot.empty) {
          const targetData = snapshot.docs[0].data();
          setMonthlyTarget(targetData.target);
          // Read reached directly from Firestore (set by admin)
          setTargetReached(targetData.reached || 0);
        } else {
          setMonthlyTarget(null);
          setTargetReached(0);
        }
      }, (error) => {
        console.error('Error fetching monthly target:', error);
      });

      return () => {
        unsubscribeTarget();
      };
    } catch (error) {
      console.error('Error setting up monthly target listener:', error);
    }
  }, [userData?.branchId, userData?.role]);;

const replacementBlock =   const fetchMonthlyTarget = React.useCallback(() => {
    if (!userData?.branchId || userData?.role !== 'receptionist') return;

    try {
      const today = new Date();
      const monthKey = \\-\\;
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const targetsRef = collection(db, 'monthly_targets');
      const qTarget = query(targetsRef, where('month', '==', monthKey), where('branchId', '==', userData.branchId));

      let u1, u3;

      const unsubscribeTarget = onSnapshot(qTarget, (snapshot) => {
        if (!snapshot.empty) {
          const targetData = snapshot.docs[0].data();
          setMonthlyTarget(targetData.target);
          
          const branchId = userData.branchId;
          const branchName = userData.branchName;

          // Start dynamic Grand Total calculation identical to Admin
          const parseD = (raw) => {
            if (!raw) return null;
            if (raw.toDate) return raw.toDate();
            if (raw.seconds) return new Date(raw.seconds * 1000);
            const d = new Date(raw); return isNaN(d.getTime()) ? null : d;
          };
          const matchesYM = (dateVal) => {
            const d = parseD(dateVal);
            if (!d) return false;
            return d.getFullYear() === year && (d.getMonth() + 1) === month;
          };
          const isBranchMatchHelper = (itemBranchId, itemBranchName) => {
            if (!branchId || branchId === 'all') return true;
            const normalize = (val) => {
              if (!val) return '';
              const str = val.toLowerCase().trim();
              if (str.includes('kphb')) return 'kphb';
              if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
              if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
              if (str.includes('nallagandla')) return 'nallagandla';
              return str.replace(/\\s*branch\\s*/i, '').trim();
            };
            const n1 = normalize(itemBranchId);
            const n2 = normalize(itemBranchName);
            const n3 = normalize(branchId);
            const n4 = normalize(branchName);
            return n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4 || itemBranchId === branchId || itemBranchName === branchName;
          };
          const getExactAmt = (p) => {
            if (p.paymentAmount !== undefined && p.paymentAmount !== null && p.paymentAmount !== '') return Number(p.paymentAmount);
            if (p.amountPaid !== undefined && p.amountPaid !== null && p.amountPaid !== '') return Number(p.amountPaid);
            if (p.itemsPaid?.consultation !== undefined) return Number(p.itemsPaid.consultation);
            return 0;
          };

          let pts = [], txs = [];
          const recalc = () => {
            const allRecords = [];
            pts.forEach(p => {
              if (p.paymentStatus === 'paid') allRecords.push({ id: p.id, ...p });
            });

            const paidRecs = allRecords.filter(p => {
              if (!isBranchMatchHelper(p.branchId, p.branchName || p.branch)) return false;
              if (!matchesYM(p.paymentCollectedAt || p.appointmentDate || p.createdAt || p.date)) return false;
              const isCons = (!p.itemsPaid || p.itemsPaid.consultation > 0 || (p.itemsPaid.consultation === undefined && p.itemsPaid.medicine === undefined));
              if (!isCons) return false;
              return true;
            });

            const consFees = paidRecs.reduce((sum, p) => sum + (p.itemsPaid?.consultation !== undefined ? Number(p.itemsPaid.consultation) : getExactAmt(p)), 0);
            const medFees = paidRecs.reduce((sum, p) => sum + (Number(p.itemsPaid?.medicine) || 0), 0);
            
            const pharmTotal = txs.filter(t => t.type !== 'consultation' && isBranchMatchHelper(t.branchId, t.branchName || t.branch) && matchesYM(t.timestamp))
                                  .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            
            setTargetReached(consFees + medFees + pharmTotal);
          };

          if(u1) u1();
          if(u3) u3();
          
          u1 = onSnapshot(collection(db, 'allpatients'), s => { pts = s.docs.map(d => ({ id: d.id, ...d.data() })); recalc(); });
          u3 = onSnapshot(collection(db, 'alltransactions'), s => { txs = s.docs.map(d => ({ id: d.id, ...d.data() })); recalc(); });

        } else {
          setMonthlyTarget(null);
          setTargetReached(0);
        }
      }, (error) => {
        console.error('Error fetching monthly target:', error);
      });

      return () => {
        unsubscribeTarget();
        if(u1) u1();
        if(u3) u3();
      };
    } catch (error) {
      console.error('Error setting up monthly target listener:', error);
    }
  }, [userData?.branchId, userData?.role]);;

content = content.replace(targetBlock, replacementBlock);
fs.writeFileSync(file, content);
console.log("Done");
