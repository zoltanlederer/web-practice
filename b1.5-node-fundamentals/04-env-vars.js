// dotenv reads the .env file and copies its values into process.env.
// This must run before accessing any process.env variables below.
// Note: .env itself is never committed (see .gitignore) — .env.example
// documents which variables are needed, without real values.
require('dotenv').config();

console.log(process.env.PORT);
console.log(process.env.GREETING);