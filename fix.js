const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

walk('src/app/customer').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('\\`') || c.includes('\\$')) {
    c = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    fs.writeFileSync(f, c);
    console.log('Fixed', f);
  }
});
