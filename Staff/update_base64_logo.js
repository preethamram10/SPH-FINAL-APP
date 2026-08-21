const fs = require('fs');
const path = require('path');

const logoPath = './assets/SH logo.png';
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = logoBuffer.toString('base64');

const editorPath = './src/screens/reception/MedicineFormEditor.js';
let content = fs.readFileSync(editorPath, 'utf8');

const base64Regex = /export const APP_ICON_BASE64 = '[^']+';/;
content = content.replace(base64Regex, `export const APP_ICON_BASE64 = '${logoBase64}';`);

fs.writeFileSync(editorPath, content, 'utf8');
console.log('Successfully updated APP_ICON_BASE64 in MedicineFormEditor.js');
