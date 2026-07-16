// Loads .env into process.env — must run before reading any process.env values below.
require('dotenv').config();
const http = require('http');
const handleRequest = require('./routes');

const PORT = process.env.PORT;

// handleRequest is imported from routes.js and passed directly as the
// per-request callback — same role as the inline arrow function in B1,
// just defined in a separate file now.
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});