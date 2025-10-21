//C:\Changshin\test\electron-app_final\scripts\rebuild-natives.js
const { rebuild } = require("@electron/rebuild");

(async () => {
  try {
    await rebuild({
      buildPath: ".",
      electronVersion: "37.5.1",          // 로그에 나온 버전과 맞추기
      force: true,
      onlyModules: ["serialport", "usb"], // 필요한 모듈만
      arch: "x64",
    });
    console.log("native rebuild done");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
