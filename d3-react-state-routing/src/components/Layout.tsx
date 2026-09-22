import { NavLink, Outlet } from 'react-router-dom';

function Layout() {
    return (
        <div>
            <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Home</NavLink>
            <NavLink to="/movies" className={({ isActive }) => isActive ? "active" : ""}>Movie list</NavLink>
            <Outlet />
        </div>
    )
}

export default Layout;