'use strict';
const { login } = require('./ecc-auth');
login().catch((e) => { console.error(e.message); process.exit(1); });
