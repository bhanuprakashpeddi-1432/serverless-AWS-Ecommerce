import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import './Header.css'

function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo">
          <h1>E-Commerce Store</h1>
        </Link>
        
        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/cart" className="nav-link">Cart</Link>
          
          {user ? (
            <>
              <Link to="/profile" className="nav-link">Profile</Link>
              {user.isAdmin && (
                <Link to="/admin" className="nav-link">Admin</Link>
              )}
              <button onClick={signOut} className="btn-secondary">
                Sign Out
              </button>
            </>
          ) : (
            <button className="btn-primary">Sign In</button>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
