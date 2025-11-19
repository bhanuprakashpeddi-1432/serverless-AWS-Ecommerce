import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * Protected Route Component - Requires Authentication and Optional Admin Role
 */
export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !user.isAdmin) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center' 
      }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>Admin privileges are required.</p>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
