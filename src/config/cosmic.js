const Cosmic = require('cosmicjs');
require('dotenv').config();

const cosmic = Cosmic(); 

const bucket = cosmic.bucket({
slug: process.env.COSMIC_BUCKET_SLUG,
read_key: process.env.COSMIC_READ_KEY,
write_key: process.env.COSMIC_WRITE_KEY
});

module.exports = bucket;