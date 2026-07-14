const http = require('http')

const server = http.createServer((req, res) => {
    res.writeHead(200,  {'Content-type': 'text/plain'});
    res.end('Hello from Node!');
});

server.listen(3000, () => {
    console.log('Listening')
});