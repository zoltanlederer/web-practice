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

    // Route: POST /echo — reads a JSON body and responds based on its content
    } else if (req.url === '/echo' && req.method === 'POST') {

        // The request body arrives in chunks (it's a stream), not all at once.
        // We accumulate each chunk into this variable as it arrives.
        let body = '';

        req.on('data', chunk => {
            body += chunk; // chunk is a Buffer, but string concatenation converts it automatically
        });

        // Fires once all chunks have arrived — only now is `body` complete.
        req.on('end', () => {
            try {
                // JSON.parse throws if `body` isn't valid JSON — caught below.
                body = JSON.parse(body);
                console.log(body);

                // res.writeHead() can only be called ONCE per response.
                // That's why it's called here, only after we know parsing
                // succeeded — not earlier, and not again in the catch block.
                res.writeHead(200, {'Content-type': 'application/json'});
                res.end(`Hello ${body.name}`);
            } catch (error) {
                // Parsing failed: respond with 400 Bad Request instead.
                // An uncaught error here would crash the whole server, since
                // this runs inside an event callback with no other safety net.
                res.writeHead(400, {'Content-type': 'application/json'});
                console.error('Invalid JSON');
                res.end(error.message);
            }
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