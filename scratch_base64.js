const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, 'staff', 'assets', 'SH logo.png');
try {
  const fileBuffer = fs.readFileSync(imgPath);
  const base64 = fileBuffer.toString('base64');
  console.log('BASE64_START');
  console.log(base64);
  console.log('BASE64_END');
} catch (err) {
  console.error('Error reading image:', err);
}
