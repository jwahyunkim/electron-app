const path = require('path');
const fse = require('fs-extra');

module.exports = async (context) => {
  const outDir = context.appOutDir; // 예: dist/win-unpacked
  const source = path.resolve(__dirname, '..', 'public');
  const target = path.join(outDir, 'public');

  if (!fse.existsSync(source)) {
    console.warn(`❌ public 폴더가 존재하지 않음: ${source}`);
    return;
  }

  try {
    await fse.copy(source, target);
    console.log(`✅ public 폴더 복사 완료: ${target}`);
  } catch (err) {
    console.error('❌ public 폴더 복사 실패:', err);
  }
};
