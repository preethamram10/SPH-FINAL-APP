import fs from 'fs';
import path from 'path';

try {
  const assetsDir = path.resolve('src/assets');
  console.log('Current CWD:', process.cwd());
  console.log('Resolved Assets Directory:', assetsDir);
  
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    console.log('Files in src/assets:', files);
    
    // Find a file that matches "SH logo" case-insensitively
    const match = files.find(f => f.toLowerCase().includes('sh logo'));
    if (match) {
      console.log(`Found a match: "${match}"`);
      const oldPath = path.join(assetsDir, match);
      const newPath = path.join(assetsDir, 'SH_logo.png');
      fs.renameSync(oldPath, newPath);
      console.log(`Successfully renamed "${match}" to "SH_logo.png"!`);
    } else {
      console.log('No file matching "SH logo" was found in assets.');
    }
  } else {
    console.log('Assets directory does not exist at:', assetsDir);
  }
} catch (err) {
  console.error('Error during execution:', err);
}
