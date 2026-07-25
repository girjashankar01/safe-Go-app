const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'screens');

function replaceBackBtnColor(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace single-line: backBtnText: { ..., color: '#16a34a', ... }
  content = content.replace(/backBtnText:\s*\{([^}]*)color:\s*'#4F46E5'([^}]*)\}/g, "backBtnText: {$1color: '#0F766E'$2}");
  
  // Replace multi-line
  // backBtnText: {
  //   fontSize: 15,
  //   color: '#16a34a',
  //   fontWeight: '600',
  // }
  let lines = content.split('\n');
  let inBackBtn = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('backBtnText: {')) {
      inBackBtn = true;
    }
    if (inBackBtn && lines[i].includes('color: \'#4F46E5\'')) {
      lines[i] = lines[i].replace('\'#4F46E5\'', '\'#0F766E\'');
      inBackBtn = false; // assumes we found it
    }
    if (inBackBtn && lines[i].includes('}')) {
      inBackBtn = false;
    }
  }
  content = lines.join('\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceBackBtnColor(fullPath);
    }
  }
}

walk(screensDir);
console.log("Done updating back button colors.");
