import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home'
import MovieList from './pages/MovieList';
import MovieDetail from './pages/MovieDetail';
import NotFound from "./pages/NotFound"
import Layout from "./components/Layout";
import Watchlist from './pages/Watchlist';

function App() {
  return (
    <div>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<MovieList />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="*" element={<NotFound />} />
        </Route>        
      </Routes>
    </div>
  )
}

export default App;