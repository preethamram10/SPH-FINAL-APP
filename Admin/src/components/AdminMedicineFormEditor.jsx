import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Save, CheckCircle2, FileText, Info } from 'lucide-react';
import logo from '../assets/SH_logo.png';

export const APP_ICON_BASE64 = '';

const DEFAULT_TITLE = 'TO WHOM SO EVER IT MAY CONCERN';
const DEFAULT_P1 = 'THIS IS TO CERTIFY THAT {GENDER} {PATIENT_NAME} AGED ABOUT {AGE} YEARS, HAS BEEN UNDER OUR TREATMENT AT SPIRITUAL HOMEOPATHY FOR THE MANAGEMENT OF {CONDITION}.';
const DEFAULT_P2 = '{HE_SHE} NEEDED TO TAKE HOMEOPATHY MEDICINE FOR {DURATION} MONTHS. WE RECOMMENDED THAT {GENDER} {PATIENT_NAME} CONTINUES TO FOLLOW THE PRESCRIBED MEDICATIONS.';

const AdminMedicineFormEditor = () => {
  const { userData } = useAuth();
  
  // Master Certificate Content States
  const [certificateTitle, setCertificateTitle] = useState(DEFAULT_TITLE);
  const [paragraph1Text, setParagraph1Text] = useState(DEFAULT_P1);
  const [paragraph2Text, setParagraph2Text] = useState(DEFAULT_P2);
  const [customCertificateText, setCustomCertificateText] = useState('');
  
  const [savingMaster, setSavingMaster] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Master Certificate Template from Firestore
  useEffect(() => {
    const fetchMasterTemplate = async () => {
      try {
        const docRef = doc(db, 'settings', 'medicine_form_template');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.certificateTitle) setCertificateTitle(data.certificateTitle);
          if (data.paragraph1Text) setParagraph1Text(data.paragraph1Text);
          if (data.paragraph2Text) setParagraph2Text(data.paragraph2Text);
          if (data.customCertificateText) setCustomCertificateText(data.customCertificateText);
        }
      } catch (err) {
        console.warn('Error fetching master medicine form template:', err);
      }
    };
    fetchMasterTemplate();
  }, []);

  // Save Master Template Content to Firestore
  const handleSaveMasterTemplate = async () => {
    setSavingMaster(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'medicine_form_template'), {
        certificateTitle: certificateTitle.trim() || DEFAULT_TITLE,
        paragraph1Text: paragraph1Text.trim(),
        paragraph2Text: paragraph2Text.trim(),
        customCertificateText: customCertificateText.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: userData?.name || 'Admin'
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      alert('Master Medicine Form Certificate Content saved successfully! All generated forms across Web Admin and Staff Apps will now use this updated content.');
    } catch (err) {
      console.error('Error saving master certificate content:', err);
      alert('Failed to save certificate content.');
    } finally {
      setSavingMaster(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '20px 24px', background: '#ffffff', borderRadius: '12px', borderLeft: '5px solid #298FCA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="#298FCA" /> Edit Medicine Form Certificate Content (Admin Settings)
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Edit the default certificate title, paragraph wording, and template content used for medicine forms system-wide.
          </p>
        </div>
        <button
          onClick={handleSaveMasterTemplate}
          disabled={savingMaster}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
        >
          {saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {savingMaster ? 'Saving Content...' : saveSuccess ? 'Saved Successfully!' : 'Save Certificate Content'}
        </button>
      </div>

      {/* EDIT CONTENT FORM & LIVE PREVIEW STACKED / FULL WIDTH */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        
        {/* EDITABLE CONTENT FIELDS CARD */}
        <div className="glass-panel" style={{ padding: '28px', backgroundColor: '#fff', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '22px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Certificate Heading & Paragraph Content</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              Modify the master certificate text format below. Receptionists fill in actual patient name, age, duration, condition, and prescribed medicines at reception.
            </p>
          </div>

          {/* DYNAMIC TAGS HELPER BADGE */}
          <div style={{ backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '13px', color: '#0369a1', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Dynamic Tags (Replaced by Receptionist Inputs):</span>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{GENDER}`}</code>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{PATIENT_NAME}`}</code>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{AGE}`}</code>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{CONDITION}`}</code>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{DURATION}`}</code>
            <code style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', color: '#0284c7' }}>{`{HE_SHE}`}</code>
          </div>

          {/* Certificate Title / Heading */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem', marginBottom: '8px', display: 'block' }}>
              Certificate Heading / Title
            </label>
            <input
              type="text"
              className="glass-input"
              value={certificateTitle}
              onChange={e => setCertificateTitle(e.target.value)}
              placeholder="TO WHOM SO EVER IT MAY CONCERN"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}
            />
          </div>

          {/* Paragraph 1 Wording */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem', marginBottom: '8px', display: 'block' }}>
              Certificate Paragraph 1 Format / Wording
            </label>
            <textarea
              className="glass-input"
              rows="4"
              value={paragraph1Text}
              onChange={e => setParagraph1Text(e.target.value)}
              placeholder="THIS IS TO CERTIFY THAT {GENDER} {PATIENT_NAME} AGED ABOUT {AGE} YEARS, HAS BEEN UNDER OUR TREATMENT AT SPIRITUAL HOMEOPATHY FOR THE MANAGEMENT OF {CONDITION}."
              style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', lineHeight: '1.7', color: '#1e293b' }}
            />
          </div>

          {/* Paragraph 2 Wording */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem', marginBottom: '8px', display: 'block' }}>
              Certificate Paragraph 2 Format / Wording
            </label>
            <textarea
              className="glass-input"
              rows="3"
              value={paragraph2Text}
              onChange={e => setParagraph2Text(e.target.value)}
              placeholder="{HE_SHE} NEEDED TO TAKE HOMEOPATHY MEDICINE FOR {DURATION} MONTHS. WE RECOMMENDED THAT {GENDER} {PATIENT_NAME} CONTINUES TO FOLLOW THE PRESCRIBED MEDICATIONS."
              style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', lineHeight: '1.7', color: '#1e293b' }}
            />
          </div>

          {/* Optional Custom Wording Override */}
          <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', marginBottom: '4px' }}>
              <Info size={18} color="#298FCA" /> Optional Full Custom Body Wording Override
            </label>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 10px 0' }}>
              Leave blank to use Paragraph 1 & 2 format above. If filled, this exact text will replace the certificate body paragraphs.
            </p>
            <textarea
              className="glass-input"
              rows="3"
              value={customCertificateText}
              onChange={e => setCustomCertificateText(e.target.value)}
              placeholder="Type full custom certificate body text here if needed..."
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', lineHeight: '1.6' }}
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <button
              onClick={handleSaveMasterTemplate}
              disabled={savingMaster}
              className="btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', fontWeight: 700, fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              {saveSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
              {savingMaster ? 'Saving Changes...' : saveSuccess ? 'Saved Successfully!' : 'Save Certificate Content'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE LETTERHEAD PREVIEW */}
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', color: '#000', fontFamily: 'Arial, sans-serif', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} /> LIVE LETTERHEAD CERTIFICATE PREVIEW (TEMPLATE FORMAT)
          </div>

          <div style={{ border: '2px solid #298FCA', minHeight: '580px', paddingBottom: '70px', position: 'relative', borderRadius: '4px' }}>
            {/* Top Header */}
            <div style={{ background: 'linear-gradient(135deg, #298FCA 0%, #1a6fa0 100%)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px' }}>SPIRITUAL</div>
                <div style={{ fontSize: '8px', color: '#d0eeff' }}>WWW.spiritualhomeoclinic.com</div>
              </div>
              <img src={logo} style={{ height: '35px', width: '35px', borderRadius: '4px' }} alt="Logo" />
            </div>
            <div style={{ height: '5px', background: '#ACCF37' }}></div>

            <div style={{ padding: '12px 24px', display: 'flex', justifycontent: 'space-between', fontSize: '10px', color: '#333' }}>
              <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
              <div>support@spiritualhomeo.com</div>
            </div>
            <div style={{ height: '1px', background: '#e0e0e0', margin: '0 24px' }}></div>

            {/* Certificate Heading */}
            <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '900', letterSpacing: '1px', padding: '16px 24px 18px', textTransform: 'uppercase', color: '#0f172a' }}>
              {certificateTitle || DEFAULT_TITLE}
            </div>

            {/* Certificate Body Text */}
            <div style={{ padding: '0 24px', fontSize: '12px', color: '#222', lineHeight: '1.7' }}>
              {customCertificateText ? (
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{customCertificateText}</p>
              ) : (
                <>
                  <p style={{ marginBottom: '10px' }}>
                    {paragraph1Text
                      .replace(/\{GENDER\}/g, '[TITLE]')
                      .replace(/\{PATIENT_NAME\}/g, '[PATIENT NAME]')
                      .replace(/\{AGE\}/g, '[AGE]')
                      .replace(/\{CONDITION\}/g, '[CONDITION / SUBJECT]')}
                  </p>
                  <p style={{ margin: 0 }}>
                    {paragraph2Text
                      .replace(/\{HE_SHE\}/g, '[HE/SHE]')
                      .replace(/\{DURATION\}/g, '[DURATION]')
                      .replace(/\{GENDER\}/g, '[TITLE]')
                      .replace(/\{PATIENT_NAME\}/g, '[PATIENT NAME]')}
                  </p>
                </>
              )}
            </div>

            {/* Prescribed Medicines Section Placeholder */}
            <div style={{ margin: '16px 24px', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
              <div style={{ background: '#f8fafc', padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', color: '#298FCA', borderBottom: '1px solid #e0e0e0' }}>PRESCRIBED MEDICINES</div>
              <div style={{ padding: '10px 14px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                [Prescribed medicines entered dynamically by Receptionist]
              </div>
            </div>

            {/* Footer seal */}
            <div style={{ textAlign: 'center', position: 'absolute', bottom: '38px', left: '0', right: '0', fontSize: '9px', color: '#666', padding: '0 24px' }}>
              <p style={{ fontStyle: 'italic', margin: 0 }}>This is a computer-generated document and does not require a physical signature.</p>
              <p style={{ marginTop: '2px', fontWeight: 'bold', color: '#475569' }}>Spiritual Homeopathy Clinic</p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #298FCA 0%, #1a6fa0 100%)', color: '#fff', padding: '8px 20px', position: 'absolute', bottom: '0', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
              <div>☎ 9069 176 176</div>
              <div>SUPPORT@SPIRITUALHOMEO.COM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMedicineFormEditor;
