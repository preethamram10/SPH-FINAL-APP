const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'assets', 'SH logo.png');
const base64 = fs.readFileSync(filePath).toString('base64');
fs.writeFileSync(path.join(__dirname, 'logo_base64.txt'), base64);
console.log('Successfully written base64 to logo_base64.txt, length:', base64.length);
