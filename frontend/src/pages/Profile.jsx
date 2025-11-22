import { useState, useEffect } from 'react'
import { ordersApi } from '../services/api'
import { useAuth } from '../components/AuthProvider'
import './Profile.css'

function Profile() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ordersApi.getAll()
      // API returns { orders: [...] } or array
      setOrders(response.data.orders || response.data || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile">
      <h1>My Profile</h1>
      
      <section className="profile-info">
        <h2>Account Information</h2>
        <div className="info-item">
          <span className="label">Email:</span>
          <span className="value">{user?.email || 'Not available'}</span>
        </div>
        <div className="info-item">
          <span className="label">Name:</span>
          <span className="value">{user?.name || 'Not available'}</span>
        </div>
      </section>

      <section className="orders-section">
        <h2>Order History</h2>
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.orderId} className="order-card">
                <div className="order-header">
                  <span className="order-id">Order #{order.orderId}</span>
                  <span className="order-status">{order.status}</span>
                </div>
                <div className="order-details">
                  <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p>Total: ${order.total?.toFixed(2)}</p>
                  <p>Items: {order.items?.length || 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Profile
