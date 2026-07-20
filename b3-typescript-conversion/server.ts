import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const app = express();

// in-memory fake data — no database yet, just a plain array
let items = [
    { id: 1, name: 'apple' },
    { id: 2, name: 'banana' },
    { id: 3, name: 'cherry' },
]

// parses JSON request bodies into req.body — must come before any route that reads req.body
app.use(express.json())

app.get('/', (req: Request, res: Response) => {
    res.send('Hello')
});

app.post('/', (req: Request, res: Response) => {
    res.send(`Hello ${req.body.name}`);
});

// logs method + full URL for any request to /items — runs before the matching route handler
app.use('/items', (req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} request to ${req.originalUrl}`);
    next();
});

// returns the full items array, or filtered by name if ?name= is provided
app.get('/items', (req: Request, res: Response) => {
    if (req.query.name) {
        const filtered = items.filter(i => i.name === req.query.name);
        res.json(filtered);
        return;
    }
    res.json(items);
});

// returns a single item by id (req.params.id is always a string, so convert it)
app.get('/items/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const item = items.find(i => i.id === id);
    if (!item) {
        res.status(404).json({error:'Item not found'});
        return;
    }
    res.json(item)
});

// adds a new item and returns it (201 = something was created)
app.post('/items', (req: Request, res: Response) => {
    const body = req.body;

    // reject if name is missing, empty, or not a string
    if (!body.name || typeof body.name !== 'string') {
        res.status(400).json({error:'name is required and must be a string'});
        return;
    }

    // base new id on highest existing id, not array length —
    // length-based ids would break once items can be deleted
    const id = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem = { id: id, name: body.name };
    items.push(newItem);
    res.status(201).json(newItem)
});

// updates an existing item by id — only overwrites fields present in req.body, leaves the rest untouched
app.patch('/items/:id', (req: Request, res: Response) => {
    // name is optional here, but if it's sent, it must be a string
    if (req.body.name !== undefined && typeof req.body.name !== 'string') {
        res.status(400).json({error:'name must be a string if provided'});
        return;
    }

    const id = Number(req.params.id);
    const index = items.findIndex(i => i.id === id); // -1 if no item matches this id
    if (index === -1){
        res.status(404).json({error:'Item not found'});
        return;
    } else {
        // strip id — clients shouldn't be able to change it
        const { id: _, ...updates } = req.body;
        // merge: existing item first, then updates on top — later spread wins on matching keys
        items[index] = { ...items[index], ...updates };
        res.status(200).json(items[index])
    }
});

// removes an item by id
app.delete('/items/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const index = items.findIndex(i => i.id === id); // -1 if no item matches this id
    if (index === -1){
        res.status(404).json({error:'Item not found'});
        return;
    } else {
        items.splice(index, 1); // removes 1 element at this position, shifts the rest down
        res.status(200).json({message:'Item deleted'})
    }
});

app.get('/broken', (req: Request, res: Response, next: NextFunction) => {
    try {
        throw new Error('Something deliberately broke');
    } catch (err) {
        next(err); // hands the error off to the error-handling middleware
    }
});

// catch-all for any request that didn't match a route above — must be the LAST app.use()
app.use((req: Request, res: Response) => {
    res.status(404).json({error:'Route not found'});
});

// error-handling middleware — Express recognizes it by having 4 params (err, req, res, next)
// only runs when something calls next(err) — otherwise this is skipped entirely
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
});

app.listen(3000, () => {
    console.log(`Listening on port 3000`)
});