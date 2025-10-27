const mongoose = require('mongoose')

// For Local Development - uncomment this line and comment Docker one:
// const URL = 'mongodb://localhost:27017/travelmemory'

// For Docker:
const URL = process.env.MONGO_URI || 'mongodb://admin:password123@mongodb:27017/travelmemory?authSource=admin'

mongoose.connect(URL)
mongoose.Promise = global.Promise
const db = mongoose.connection
db.on('error', console.error.bind(console, 'DB ERROR: '))
module.exports = {db, mongoose}