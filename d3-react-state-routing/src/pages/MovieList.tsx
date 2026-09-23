import type { Movie } from '../types'
import movies from '../data/movies.json'
import { Link } from 'react-router-dom'

function MovieList() {
    const typedMovies = movies as Movie[];

    return (
        <>
        <h1>Movie list</h1>
        <ul>
            {typedMovies.map(item => (
                <li key={item.id}><Link to={`/movies/${item.id}`} >{item.title}</Link></li>
            ))}
        </ul>
        </>
    )
}

export default MovieList;