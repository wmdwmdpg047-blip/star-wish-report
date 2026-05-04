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
  let d = gmt();
  const listXml = await req('GET', '/?prefix=records/&max-keys=500', {
    Date: d, Authorization: `OSS ${KEY}:${sign('GET', d, `/${BUCKET}/`)}`,
  });
  const keys = [...listXml.matchAll(/<Key>(records\/\d+_\d+\.json)<\/Key>/g)].map(m => m[1]);

  const records = [];
  for (const key of keys) {
    try {
      d = gmt();
      const path = `/${key}`;
      const json = await req('GET', path, {
        Date: d, Authorization: `OSS ${KEY}:${sign('GET', d, `/${BUCKET}${path}`)}`,
      });
      const r = JSON.parse(json);
      const id = key.match(/(\d+_\d+)/)[1];
      r._id = id; r._hour = parseInt(id.slice(9, 11), 10);
      records.push(r);
      console.log('✅', id);
    } catch (e) { console.log('❌', key, e.message); }
  }
  records.sort((a, b) => a._id.localeCompare(b._id));
  fs.writeFileSync('data.json', JSON.stringify(records, null, 2));
  console.log('✅', records.length, '条记录');
})();
