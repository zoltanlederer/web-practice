const fs = require('fs').promises;

async function writeAndReadFile() {
    try {
        // Writes 'Test text' to notes.txt, creating the file if it doesn't exist,
        // or overwriting it if it does.
        await fs.writeFile('notes.txt', 'Test text');
        console.log('File written!');

        // Without a second argument, readFile returns a Buffer (raw bytes),
        // not a readable string — passing 'utf-8' tells Node to decode
        // those bytes into text automatically.
        const content = await fs.readFile('./notes.txt', 'utf-8');
        console.log(content);
    } catch (error) {
        // Real file operations can fail (permissions, missing disk space,
        // invalid paths, etc.) — always worth handling.
        console.error('Something went wrong:', error.message);
    }
}

writeAndReadFile();