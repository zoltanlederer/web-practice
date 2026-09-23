import type { Movie } from '../types'
import movies from '../data/movies.json'
import { useParams } from "react-router-dom";
import NotFound from './NotFound';

function MovieDetail() {
    const { id } = useParams()

    const typedMovies = movies as Movie[];

    const movie = typedMovies.find(movie => movie.id === id)

    if(!movie) {
        return (
            <NotFound />
        )
    }

    return (
        <>
        <h1>Movie detail</h1>
        <p>Title: {movie.title}</p>
        <p>Year: {movie.year}</p>
        </>
    )
}

export default MovieDetail;