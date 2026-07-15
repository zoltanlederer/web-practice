const http = require('http');

const server = http.createServer((req, res) => {
    // Route: home page
    if (req.url === '/') {
        res.writeHead(200, {'Content-type': 'text/plain'});
        res.end('Home page');

    // Route: about page
    } else if (req.url === '/about') {
        res.writeHead(200, {'Content-type': 'text/plain'});
        res.end('About page');

    // Route: POST /echo — reads the request body and sends it back
    } else if (req.url === '/echo' && req.method === 'POST') {
        // Headers don't depend on the body here, so it's safe to send them early.
        // If a header ever needed to depend on the body (e.g. Content-Length),
        // writeHead() would have to move inside the 'end' handler below.
        res.writeHead(200, {'Content-type': 'text/plain'});

        // The request body arrives in chunks (it's a stream), not all at once.
        // We accumulate each chunk into this variable as it arrives.
        let body = '';

        req.on('data', chunk => {
            body += chunk; // chunk is a Buffer, but string concatenation converts it automatically
        });

        // Fires once all chunks have arrived — only now is `body` complete.
        req.on('end', () => {
            res.end(`You sent: ${body}`);
        });

    // Fallback: no matching route
    } else {
        res.writeHead(404, {'Content-type': 'text/plain'});
        res.end('Not Found');
    }
});

server.listen(3000, () => {
    console.log('Listening');
});