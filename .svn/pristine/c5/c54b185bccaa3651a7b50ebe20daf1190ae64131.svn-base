// ...기존 public/version.txt, public/latest.json 생성 유지
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const version = pkg.version || '0.0.0';

// public 쪽 (그대로 유지)
const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'version.txt'), version + '\n', 'utf8');
fs.writeFileSync(path.join(publicDir, 'latest.json'),
  JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2), 'utf8');

// ✅ resources 루트로 보낼 파일을 빌드 자산 폴더에 준비
const buildAssetsDir = path.join(__dirname, '..', 'build-assets');
fs.mkdirSync(buildAssetsDir, { recursive: true });
fs.writeFileSync(path.join(buildAssetsDir, 'latest.json'),
  JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2), 'utf8');

console.log('[write-public-version] prepared:', {
  public: 'public/latest.json, public/version.txt',
  resources: 'build-assets/latest.json → resources/latest.json'
});
