import express from 'express';
// type-only import — Request/Response/NextFunction don't exist at runtime,
// they're erased when compiled to JS; verbatimModuleSyntax requires marking this explicitly
import type { Request, Response, NextFunction } from 'express';
const app = express();

// interface describes the shape of ONE item — array-ness is added separately at the point of use (Item[])
interface Item {
    id: number;
    name: string;
}

// shape of what a client is allowed to send when creating a new item —
// deliberately does NOT include 'id', since that's generated server-side, not client-supplied
interface NewItemBody {
    name: string;
}

// shape of a PATCH body — name is optional since PATCH allows partial updates
interface ItemUpdate {
    name?: string;
}

// in-memory fake data — no database yet, just a plain array
// Item[] is somewhat redundant here since TypeScript could infer this from the literal array,
// but it protects against future mistakes (e.g. pushing a malformed object) and stays explicit
// for readability — becomes strictly necessary the moment this isn't a pre-filled literal (e.g. an empty array)
let items: Item[] = [
    { id: 1, name: 'apple' },
    { id: 2, name: 'banana' },
    { id: 3, name: 'cherry' },
]

// parses JSON request bodies into req.body — must come before any route that reads req.body
app.use(express.json())

// req: Request, res: Response — Express's own types, from @types/express;
// without these, req/res would implicitly be 'any' and TypeScript would stop checking them
app.get('/', (req: Request, res: Response) => {
    res.send('Hello')
});

// Request<{}, {}, Item> types req.body — the 3 generic slots are Params, ResBody, ReqBody;
// {} placeholders skip the first two since this route doesn't care about them
app.post('/', (req: Request<{}, {}, Item>, res: Response) => {
    const body = req.body
    res.send(`Hello ${body.name}`);
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
// req.body typed as NewItemBody — TypeScript now knows body.name should be a string,
// but this is still a compile-time-only guarantee: it says nothing about what the
// client actually sends over the wire, so the manual check below is still required
app.post('/items', (req: Request<{}, {}, NewItemBody>, res: Response) => {
    const body = req.body;

    // reject if name is missing, empty, or not a string — TypeScript's type doesn't
    // check the real request at runtime, this manual check is the actual enforcement
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
// Request<{ id: string }, {}, ItemUpdate> — first slot types req.params (route has :id),
// third slot types req.body as the optional-name shape defined by ItemUpdate
app.patch('/items/:id', (req: Request<{id: string}, {}, ItemUpdate>, res: Response) => {
    // name is optional (per ItemUpdate), but if it's sent, it must be a string —
    // again, TypeScript's type is compile-time only, this check is the real enforcement
    const body = req.body
    if (body.name !== undefined && typeof body.name !== 'string') {
        res.status(400).json({error:'name must be a string if provided'});
        return;
    }

    const id = Number(req.params.id);
    const index = items.findIndex(i => i.id === id); // -1 if no item matches this id
    // pulled into its own variable so TypeScript can "narrow" it below — checking
    // items[index] fresh each time wouldn't let TypeScript treat it as guaranteed
    const existingItem = items[index];

    if (index === -1 || !existingItem){
        res.status(404).json({error:'Item not found'});
        return;
    }

    // built explicitly (not via {...items[index], ...body}) — a spread merge here would
    // make 'id' inferred as optional (since ItemUpdate never has 'id'), which fails
    // against Item's required 'id'; '??' falls back to the existing name if none was sent
    items[index] = {
        id: existingItem.id,
        name: body.name ?? existingItem.name
    }
    res.status(200).json(items[index])
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

// error-handling middleware — Express recognizes it by having 4 params (err, req, res, next),
// counted structurally, not by name; err: Error is TypeScript's built-in type for error objects
// only runs when something calls next(err) — otherwise this is skipped entirely
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
});

app.listen(3000, () => {
    console.log(`Listening on port 3000`)
});