// Vercel 서버리스 함수 진입점
// 빌드된 Express 앱을 import하여 export
const app = require('../dist/index.cjs');

// esbuild가 export default를 module.exports.default로 변환하므로
// default 속성을 확인하거나 직접 app을 export
module.exports = app.default || app;
