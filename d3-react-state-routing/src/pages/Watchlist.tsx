import { useEffect, useReducer, useRef, useState } from "react";

interface WatchListItem {
    id: string;
    title: string;
    year: number;
    note: string;
}

// Union type: an action is EITHER an "add" shape OR a "remove" shape,
// never both at once. TypeScript narrows to the right shape inside
// the reducer once `action.type` is checked.
type WatchlistAction =
    { type: 'add'; title: string; year: number; note: string }
    | { type: 'remove'; id: string }

// Pure function: given the current state and an action, returns the
// NEW state. Never mutates `state` directly — new arrays are built
// with spread/filter instead of pushing/splicing in place, since
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
                title: action.title,
                year: action.year,
                note: action.note
            }
        ]
    }
    if (action.type === 'remove') {
        // Keep every item EXCEPT the one whose id matches the one
        // being removed. Easy bug to make: using === here instead of
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
    // `state` holds the actual watchlist array; `dispatch` is the way
    // to ask the reducer to change it — `state` is never set directly.
    const [state, dispatch] = useReducer(reducer, [])

    // Separate from `state` above — these only track what's CURRENTLY
    // TYPED in the form, before submission. All three are kept as
    // strings, even `year`, because an <input>'s onChange always hands
    // back a string — conversion to a number happens only at
    // validation/dispatch time, not while typing.
    const [watchItem, setWatchItem] = useState<string>('')
    const [year, setYear] = useState<string>('')
    const [note, setNote] = useState<string>('')

    // Holds one error message per invalid field (undefined = no error
    // for that field). Kept separate from the field values themselves,
    // since "what was typed" and "what's wrong with it" are two
    // different concerns.
    const [errors, setErrors] = useState<{ title?: string; year?: string }>({})

    // A ref, unlike useState, doesn't trigger a re-render when it
    // changes, and its value survives across renders without being
    // reset. Here it's used to get a handle on the actual DOM node
    // for the Title input, so it can be focused programmatically —
    // something React state alone can't do, since state only
    // describes what to render, not direct DOM operations like
    // .focus(). Starts as null because before the first render,
    // the DOM node doesn't exist yet.
    const inputRef = useRef<HTMLInputElement>(null)

    // Empty dependency array [] means this effect runs exactly once,
    // right after the component's first render — the right moment to
    // focus the input, since by then React has attached inputRef to
    // the real DOM node. The ?. guards against .current still being
    // null (TypeScript requires the check, since that's its declared type).
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleAdd = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault() // stop the browser's default full-page reload on submit
        setErrors({}) // clear any errors left over from a previous failed attempt

        // Validate title: reject empty or whitespace-only input.
        // .trim() matters here — "   " has length > 0 but isn't a real title.
        if (watchItem.length <= 0 || watchItem.trim().length == 0) {
            setErrors({ title: 'Title input is empty' })
            setWatchItem('')
            return // stop here — no dispatch on invalid input
        }

        // Validate year: must convert to a real number in a sane range.
        // Number('') is 0, not NaN, so an isNaN-only check would let an
        // empty year slip through — hence the explicit === 0 check,
        // alongside isNaN() for genuinely non-numeric input like "abc".
        if (Number(year) === 0 || isNaN(Number(year)) || Number(year) <= 1900 || Number(year) >= 2030) {
            setErrors({ year: 'The year input is not valid ' })
            setYear('')
            return
        }

        // Both fields passed validation — safe to dispatch now.
        dispatch({ type: 'add', title: watchItem, year: Number(year), note: note })
        setWatchItem('') // clear the inputs after a successful add
        setYear('')
        setNote('')
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
                    truth for the value, not the DOM itself. ref is used
                    only for the one-off .focus() call above — it doesn't
                    replace the value/onChange pair, which still owns the
                    field's actual content. */}
                <input id='add-item' value={watchItem} ref={inputRef} onChange={(e) => setWatchItem(e.target.value)} />

                <label htmlFor='add-year'>Year:</label>
                <input id='add-year' value={year} onChange={(e) => setYear(e.target.value)} />

                <label htmlFor='add-note'>Note:</label>
                {/* Optional field — deliberately has no validation, to
                    show that not every field in a form needs one. */}
                <input id='add-note' value={note} onChange={(e) => setNote(e.target.value)} />

                <button type='submit'>Add</button>
                {/* Renders nothing visible when the corresponding error
                    is undefined — React skips undefined/false children. */}
                <p>{errors.title}</p>
                <p>{errors.year}</p>
            </form>
            <h2>Movies in the watchlist</h2>
            <ul>
                {state.map(item => (
                    // `key` must be stable and unique per item so React
                    // can track which list item is which across renders
                    // — using the array index here would break the
                    // remove logic once items are reordered/removed.
                    <li key={item.id}>
                        {item.title} ({item.year}) <br />
                        {/* Fragment needed here since two things are being
                            rendered (text + <br/>) from one && expression —
                            a template string wouldn't turn <br/> into a
                            real line break, just literal text. */}
                        {item.note && <>Note: {item.note} <br /></>}
                        <button onClick={() => handleRemove(item.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </>
    )
}

export default Watchlist;