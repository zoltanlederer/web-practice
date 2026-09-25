import { useReducer, useState } from "react";

interface WatchListItem {
    id: string;
    title: string;
}

// Union type: an action is EITHER an "add" shape OR a "remove" shape,
// never both at once. TypeScript narrows to the right shape inside
// the reducer once `action.type` is checked.
type WatchlistAction =
    { type: 'add'; title: string }
    | { type: 'remove'; id: string }

// Pure function: given the current state and an action, returns the
// NEW state. Never mutates `state` directly (that's why we build new
// arrays with spread/filter instead of pushing/splicing in place) —
// React relies on getting a new array reference to know it should
// re-render.
function reducer(state: WatchListItem[], action: WatchlistAction) {
    if (action.type === 'add') {
        return [
            ...state, // keep all existing items
            {
                // crypto.randomUUID() generates a unique id, since the
                // user only supplies a title — nothing else identifies
                // this item yet.
                id: crypto.randomUUID(),
                title: action.title
            }
        ]
    }
    if (action.type === 'remove') {
        // Keep every item EXCEPT the one whose id matches the one
        // we're removing. Easy bug to make: using === here instead of
        // !== keeps only the matching item and drops everything else.
        const remove = state.filter(item => item.id !== action.id)
        return remove
    }
    // Defensive fallback: if `action.type` is ever something other
    // than 'add' or 'remove' (e.g. a future typo), fail loudly
    // instead of silently doing nothing.
    throw Error('Unknown action')
}

function Watchlist() {
    // `state` holds the actual watchlist array; `dispatch` is how we
    // ask the reducer to change it (we never set `state` directly).
    const [state, dispatch] = useReducer(reducer, [])

    // Separate from `state` above — this only tracks what the user is
    // CURRENTLY TYPING in the input, before they submit.
    const [watchItem, setWatchItem] = useState<string>('')

    const handleAdd = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault() // stop the browser's default full-page reload on submit
        dispatch({ type: 'add', title: watchItem })
        setWatchItem('') // clear the input after adding
    }

    const handleRemove = (removeId: string) => {
        dispatch({ type: 'remove', id: removeId })
    }

    return (
        <>
            <h1>Watchlist</h1>
            <form onSubmit={handleAdd}>
                <label htmlFor='add-item'>Title:</label>
                {/* Controlled input: React state is the single source of
                    truth for the value, not the DOM itself. */}
                <input id='add-item' value={watchItem} onChange={(e) => setWatchItem(e.target.value)} />
                <button type='submit'>Add</button>
            </form>
            <h2>Movies in the watchlist</h2>
            <ul>
                {state.map(item => (
                    // `key` must be stable and unique per item so React
                    // can track which list item is which across renders
                    // — using the array index here would break the
                    // remove logic once items are reordered/removed.
                    <li key={item.id}>
                        {item.title} - <button onClick={() => handleRemove(item.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </>
    )
}

export default Watchlist;