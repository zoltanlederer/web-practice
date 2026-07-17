const express = require('express');
const app = express();

// in-memory fake data — no database yet, just a plain array
let items = [
    { id: 1, name: 'apple' },
    { id: 2, name: 'banana' },
    { id: 3, name: 'cherry' },
]

// parses JSON request bodies into req.body — must come before any route that reads req.body
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello')
});

app.post('/', (req, res) => {
    res.send(`Hello ${req.body.name}`);
});

// returns the full items array
app.get('/items', (req, res) => {
    res.json(items);
});

// returns a single item by id (req.params.id is always a string, so convert it)
app.get('/items/:id', (req, res) => {
    const id = Number(req.params.id);
    const item = items.find(i => i.id === id);
    if (!item) {
        res.status(404).json({error:'Item not found'});
        return;
    }
    res.json(item)
});

// adds a new item and returns it (201 = something was created)
app.post('/items', (req, res) => {
    const body = req.body;
    // base new id on highest existing id, not array length —
    // length-based ids would break once items can be deleted
    const id = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem = { id: id, name: body.name };
    items.push(newItem);
    res.status(201).json(newItem)
});

app.listen(3000, () => {
    console.log(`Listening on port 3000`)
});