const http = require('http');

const server = http.createServer((req, res) => {
    console.log('********')
    console.log(req.url)
    if (req.url === '/'){
        res.writeHead(200,  {'Content-type': 'text/plain'});
        res.end('Home page');
    } else if (req.url === '/about') {
        res.writeHead(200,  {'Content-type': 'text/plain'});
        res.end('About page');
    } else {
        res.writeHead(404,  {'Content-type': 'text/plain'});
        res.end('Not Found');
    }
});

server.listen(3000, () => {
    console.log('Listening')
});