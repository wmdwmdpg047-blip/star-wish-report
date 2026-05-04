const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const KEY = process.env.OSS_KEY;
const SECRET = process.env.OSS_SECRET;
const BUCKET = 'star-wish-box';
const HOST = `${BUCKET}.oss-cn-hangzhou.aliyuncs.com`;

function sign(m, d, r) { return crypto.createHmac('sha1', SECRET).update(`${m}\n\n\n${d}\n${r}`).digest('base64'); }
function gmt() { return new Date().toUTCString(); }

function req(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    https.request({ hostname: HOST, path, method, headers, timeout: 15000 }, res => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => res.statusCode < 300 ? resolve(b) : reject(new Error(`HTTP ${res.statusCode}`)));
    }).on('error', reject).end();
  });
}

(async () => {
  const d = gmt(), s = sign('GET', d, `/${BUCKET}/`);
  const xml = await req('GET', '/?prefix=records/&max-keys=500', { Date: d, Authorization: `OSS ${KEY}:${s}` });
  const keys = [...xml.matchAll(/<Key>records\/(\d+_\d+)\.json<\/Key>/g)].map(m => m[0]);

  const records = [];
  for (const key of keys) {
    try {
      const j = await req('GET', `/${key.slice(5, -1)}`);
      const r = JSON.parse(j);
      const id = key.match(/(\d+_\d+)/)[1];
      r._id = id; r._hour = parseInt(id.slice(9, 11), 10);
      records.push(r);
    } catch (e) { console.error(key, e.message); }
  }
  records.sort((a, b) => a._id.localeCompare(b._id));
  fs.writeFileSync('data.json', JSON.stringify(records, null, 2));
  console.log(`✅ ${records.length} 条记录`);
})();
