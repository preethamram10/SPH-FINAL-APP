const fs = require('fs');
const file = 'c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/Dashboard.js';
let content = fs.readFileSync(file, 'utf8');

// Inject medicinesHtml definition before return `
const returnStr = '    return `';
const medicinesHtmlDef = `    let medicinesHtml = '';
    if (appt.itemsPaid && appt.itemsPaid.medicinesList && appt.itemsPaid.medicinesList.length > 0) {
      medicinesHtml = \\\`
      <div style="font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 15px;">Prescribed Medicines</div>
      <table class="details-table" style="margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Medicine Name</th>
            <th>Type</th>
            <th>Dosage</th>
            <th style="text-align: right;">Price (₹)</th>
          </tr>
        </thead>
        <tbody>
          \\\${appt.itemsPaid.medicinesList.map(med => \\\`
            <tr>
              <td style="font-weight: 700; color: #1e293b;">\\\${med.name || '-'}</td>
              <td style="color: #475569;">\\\${med.type || '-'}</td>
              <td style="color: #475569;">\\\${med.dosage || '-'}</td>
              <td style="text-align: right; font-weight: 700; color: #1e293b;">\\\${med.price ? '₹' + med.price : '-'}</td>
            </tr>
          \\\`).join('')}
        </tbody>
      </table>\\\`;
    }\n\n`;

content = content.replace(returnStr, medicinesHtmlDef + returnStr);

// Inject medicinesHtml inside HTML string
content = content.replace(/      <\/table>\n  \n      <div class="amount-box">/, '      </table>\n      ${medicinesHtml}\n      <div class="amount-box">');

// Update Logo Height
content = content.replace(/<img src="data:image\/png;base64,\$\{APP_ICON_BASE64\}" style="height: 50px; width: auto; border-radius: 6px;" \/>/, '<img src="data:image/png;base64,${APP_ICON_BASE64}" style="height: 80px; width: auto; border-radius: 6px;" />');

fs.writeFileSync(file, content);
console.log('Successfully updated Dashboard.js');

