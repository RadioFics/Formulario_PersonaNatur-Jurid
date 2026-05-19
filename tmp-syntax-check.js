const fs = require('fs');
const lines = fs.readFileSync('public/js/seccion-ac.js','utf8').split('\n');
let start = 0, end = lines.length, lastGood = 0;
while (start < end) {
  const mid = Math.floor((start + end) / 2);
  const chunk = lines.slice(0, mid + 1).join('\n');
  try {
    new Function(chunk);
    lastGood = mid;
    start = mid + 1;
  } catch (e) {
    end = mid;
  }
}
console.log('first bad line', end + 1);
