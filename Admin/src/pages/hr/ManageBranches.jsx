import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Building2, Save, UploadCloud, Clock, Phone, MapPin, Image as ImageIcon, Navigation, Trash2, Plus } from 'lucide-react';

const CANONICAL_BRANCHES_DATA = [
  {
    id: 'kphb',
    name: 'KPHB Branch',
    timings: '10:00 AM - 8:30 PM',
    phone: '9030176176',
    address: 'Plot no 27, near ideal kitchen, KPHB Phase 15, Hyderabad, 500085',
    landmark: 'Near ideal kitchen',
    imageUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80',
    directionUrl: 'https://www.google.com/maps/search/?api=1&query=Spiritual+Homeopathy+KPHB'
  },
  {
    id: 'nallagandla',
    name: 'Nallagandla Branch',
    timings: '10:00 AM - 8:30 PM',
    phone: '9132176176',
    address: 'Sai Ram Nagar colony, Plot no 83, Kanchi Gachibowli Rd, Tellapur, Nallagandla, Hyderabad, Telangana 500019',
    landmark: 'Opp. Navodaya Vidyalaya, Hyderabad',
    imageUrl: 'https://images.unsplash.com/photo-1586773860418-d372a67de556?auto=format&fit=crop&w=600&q=80',
    directionUrl: 'https://www.google.com/maps/search/?api=1&query=Spiritual+Homeopathy+Nallagandla'
  },
  {
    id: 'dilshuknagar',
    name: 'Dilshuknagar Branch',
    timings: '10:00 AM - 8:30 PM',
    phone: '9804176176',
    address: '4-110, Spiritual Homeopathy, Near Metro Station Pillar No 1540, Beside lane of Bata Showroom, Dilshuknagar, Hyderabad-500060',
    landmark: 'Near Metro Station Pillar No 1540, Beside lane of Bata Showroom',
    imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
    directionUrl: 'https://www.google.com/maps/search/?api=1&query=Spiritual+Homeopathy+Dilshuknagar'
  },
  {
    id: 'chandanagar',
    name: 'Chandanagar Branch',
    timings: '10:00 AM - 8:30 PM',
    phone: '9553176176',
    address: 'House Number 4-118, Lane opp. to Balaji Temple, Beside bank of commerce, Gangaram, Chandnagar, Hyderabad - 500050',
    landmark: 'Lane opp. to Balaji Temple, Beside bank of commerce',
    imageUrl: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?auto=format&fit=crop&w=600&q=80',
    directionUrl: 'https://www.google.com/maps/search/?api=1&query=Spiritual+Homeopathy+Chandanagar'
  }
];

const ManageBranches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [timings, setTimings] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [directionUrl, setDirectionUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      // 1. Fetch from 'branches' collection
      let snap = await getDocs(collection(db, 'branches'));
      let dbData = [];
      if (!snap.empty) {
        snap.forEach(d => dbData.push({ id: d.id, ...d.data() }));
      }
      
      // 2. Fetch from 'users' collection where role == 'branch'
      const qUsers = query(collection(db, 'users'), where('role', '==', 'branch'));
      const snapUsers = await getDocs(qUsers);
      snapUsers.forEach(d => {
        const u = d.data();
        const existing = dbData.find(b => b.id === d.id || b.name?.toLowerCase() === u.name?.toLowerCase());
        if (!existing) {
          dbData.push({ id: d.id, ...u });
        } else {
          Object.assign(existing, u);
        }
      });

      // 3. Merge canonical defaults so no branch is empty
      const mergedList = CANONICAL_BRANCHES_DATA.map(def => {
        const found = dbData.find(d => {
          const dId = (d.id || '').toLowerCase();
          const dName = (d.name || d.branchName || '').toLowerCase();
          return dId === def.id || dName.includes(def.id) || def.id.includes(dId);
        });

        if (found) {
          const rawImgs = found.images && Array.isArray(found.images) && found.images.length > 0
            ? found.images
            : (found.imageUrl || found.image ? [found.imageUrl || found.image] : [def.imageUrl]);

          return {
            ...def,
            ...found,
            id: def.id,
            name: found.name || def.name,
            timings: found.timings || def.timings,
            phone: found.phone || found.phoneNumber || def.phone,
            address: found.address || def.address,
            landmark: found.landmark || def.landmark,
            imageUrl: rawImgs[0] || def.imageUrl,
            images: rawImgs
          };
        }
        return { ...def, images: [def.imageUrl] };
      });

      setBranches(mergedList);
    } catch (error) {
      console.error('Error fetching branches:', error);
      alert('Failed to fetch branch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const selectBranchForEdit = (branch) => {
    setSelectedBranch(branch);
    setTimings(branch.timings || '');
    setAddress(branch.address || '');
    setLandmark(branch.landmark || '');
    setPhone(branch.phone || '');
    const initialImgs = branch.images && Array.isArray(branch.images) && branch.images.length > 0
      ? branch.images
      : (branch.imageUrl || branch.image ? [branch.imageUrl || branch.image] : []);
    setImagesList(initialImgs);
    setImageUrl(initialImgs[0] || '');
    setDirectionUrl(branch.directionUrl || branch.mapUrl || '');
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedBranch) return;

    setUploadingImage(true);
    const newUrls = [];

    for (const file of files) {
      try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `branch_images/${selectedBranch.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        newUrls.push(downloadURL);
      } catch (storageErr) {
        console.warn("Storage upload failed, fallback to Base64:", storageErr);
        const base64Url = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (base64Url) newUrls.push(base64Url);
      }
    }

    if (newUrls.length > 0) {
      setImagesList(prev => [...prev, ...newUrls]);
      if (!imageUrl) setImageUrl(newUrls[0]);
      alert(`${newUrls.length} image(s) added! Click "Save Branch Details" to apply.`);
    }
    setUploadingImage(false);
  };

  const handleAddUrl = () => {
    if (!imageUrl || !imageUrl.trim()) return;
    const url = imageUrl.trim();
    if (!imagesList.includes(url)) {
      setImagesList(prev => [...prev, url]);
      setImageUrl('');
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImagesList(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    try {
      const mainImg = imagesList.length > 0 ? imagesList[0] : (imageUrl.trim() || '');
      const payload = {
        name: selectedBranch.name,
        timings: timings.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        phone: phone.trim(),
        images: imagesList,
        imageUrl: mainImg,
        image: mainImg,
        directionUrl: directionUrl.trim(),
        mapUrl: directionUrl.trim()
      };

      // 1. Save to 'branches' collection with canonical branch ID (e.g. 'kphb')
      await setDoc(doc(db, 'branches', selectedBranch.id), payload, { merge: true });

      // 2. Also save to 'branches' collection with normalized name key
      const nameKey = selectedBranch.id.toLowerCase();
      await setDoc(doc(db, 'branches', nameKey), payload, { merge: true });

      // 3. Save to 'users' collection where role == 'branch'
      const qUsers = query(collection(db, 'users'), where('role', '==', 'branch'));
      const snapUsers = await getDocs(qUsers);
      for (const uDoc of snapUsers.docs) {
        const uData = uDoc.data();
        const uId = uDoc.id.toLowerCase();
        const uName = (uData.name || uData.branchName || uData.username || '').toLowerCase();
        if (uId.includes(nameKey) || uName.includes(nameKey)) {
          await setDoc(doc(db, 'users', uDoc.id), payload, { merge: true });
        }
      }

      alert('Clinic branch details & photo gallery updated successfully!');
      setSelectedBranch(null);
      fetchBranches();
    } catch (error) {
      console.error('Error updating branch:', error);
      alert('Failed to update branch details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading branches...</div>;
  }

  if (selectedBranch) {
    return (
      <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <button 
          onClick={() => setSelectedBranch(null)}
          className="btn-secondary"
          style={{ marginBottom: '20px' }}
        >
          ← Back to Branches
        </button>

        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Building2 size={28} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '24px' }}>Edit {selectedBranch.name}</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Multiple Branch Images Gallery Section */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={18} color="#258ec8" /> Clinic Photos Gallery ({imagesList.length})
                </h3>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  style={{ display: 'none' }} 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                  disabled={uploadingImage}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', borderRadius: '8px' }}
                >
                  <UploadCloud size={16} /> {uploadingImage ? 'Uploading...' : 'Add Photos (Multiple)'}
                </button>
              </div>

              {/* Photos Grid */}
              {imagesList.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {imagesList.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100%', height: '100px', borderRadius: '10px', overflow: 'hidden', border: idx === 0 ? '2px solid #258ec8' : '1px solid #cbd5e1' }}>
                      <img src={url} alt={`Branch ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {idx === 0 && (
                        <span style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#258ec8', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>COVER</span>
                      )}
                      <button 
                        onClick={() => handleRemoveImage(idx)}
                        style={{ position: 'absolute', top: 4, right: 4, width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove Photo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
                  No photos added yet. Upload files or paste image URLs below.
                </div>
              )}

              {/* Paste Image URL box */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={imageUrl} 
                  onChange={e => setImageUrl(e.target.value)} 
                  placeholder="Paste additional Image Web URL here (https://...)" 
                  style={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    color: '#0f172a',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={handleAddUrl}
                  type="button"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', padding: '9px 14px', borderRadius: '8px', backgroundColor: '#258ec8', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  <Plus size={16} /> Add URL
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#258ec8" /> Operating Timings
              </label>
              <input 
                type="text" 
                value={timings} 
                onChange={e => setTimings(e.target.value)} 
                placeholder="e.g. 10:00AM - 8:30PM"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="#258ec8" /> Contact Phone
              </label>
              <input 
                type="text" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="10-digit phone number e.g. 9132176176"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#ef4444" /> Clinic Address
              </label>
              <textarea 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Full street address of the clinic branch"
                rows="3"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#f59e0b" /> Landmark
              </label>
              <input 
                type="text" 
                value={landmark} 
                onChange={e => setLandmark(e.target.value)} 
                placeholder="e.g. Opp. Navodaya Vidyalaya, Hyderabad"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={16} color="#258ec8" /> Google Maps Direction URL / Location Link
              </label>
              <input 
                type="text" 
                value={directionUrl} 
                onChange={e => setDirectionUrl(e.target.value)} 
                placeholder="https://maps.app.goo.gl/... or https://www.google.com/maps/search/?api=1&query=..."
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Patients clicking "Get Directions" in the Patient App will be opened in Google Maps with this link.
              </p>
            </div>

            <button 
              onClick={handleSave}
              className="btn-primary"
              disabled={saving}
              style={{
                padding: '14px',
                fontSize: '16px',
                fontWeight: '700',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px',
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                cursor: 'pointer'
              }}
            >
              <Save size={20} /> {saving ? 'Saving Branch Details...' : 'Save Branch Details'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={24} color="var(--primary-color)" /> Manage Clinic Branches
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
          Select a branch to edit its address, timings, contact, and display image for the patient app.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {branches.map(branch => (
          <div 
            key={branch.id} 
            className="glass-panel" 
            style={{ padding: '20px', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}
            onClick={() => selectBranchForEdit(branch)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Building2 size={20} color="var(--primary-color)" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>{branch.name}</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} /> <span>{branch.timings || 'Not Set'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} /> <span>{branch.phone || 'Not Set'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{branch.address || 'Not Set'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={14} /> <span style={{ color: (branch.imageUrl || branch.image) ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{(branch.imageUrl || branch.image) ? 'Image Uploaded' : 'No Image'}</span>
              </div>
            </div>
          </div>
        ))}
        {branches.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            No branches found in the system.
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageBranches;
