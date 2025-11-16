import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cartApi } from '../services/api'
import CartSummary from '../components/CartSummary'
import './Cart.css'

function Cart() {
  const navigate = useNavigate()
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCart()
  }, [])

  const fetchCart = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await cartApi.get()
      setCart(response.data)
    } catch (err) {
      console.error('Error fetching cart:', err)
      setError('Failed to load cart.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQuantity = async (productId, quantity) => {
    try {
      await cartApi.updateItem(productId, { quantity })
      fetchCart()
    } catch (err) {
      console.error('Error updating quantity:', err)
      alert('Failed to update quantity.')
    }
  }

  const handleRemoveItem = async (productId) => {
    try {
      await cartApi.removeItem(productId)
      fetchCart()
    } catch (err) {
      console.error('Error removing item:', err)
      alert('Failed to remove item.')
    }
  }

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      try {
        await cartApi.clear()
        fetchCart()
      } catch (err) {
        console.error('Error clearing cart:', err)
        alert('Failed to clear cart.')
      }
    }
  }

  const handleCheckout = () => {
    navigate('/checkout')
  }

  if (loading) return <div className="loading">Loading cart...</div>
  if (error) return <div className="error">{error}</div>

  const items = cart?.items || []
  const isEmpty = items.length === 0

  return (
    <div className="cart">
      <h1>Shopping Cart</h1>
      {isEmpty ? (
        <div className="empty-cart">
          <p>Your cart is empty</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.productId} className="cart-item">
                <img
                  src={item.imageUrl || 'https://via.placeholder.com/100'}
                  alt={item.name}
                />
                <div className="item-details">
                  <h3>{item.name}</h3>
                  <p className="item-price">${item.price?.toFixed(2)}</p>
                </div>
                <div className="item-quantity">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateQuantity(item.productId, parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="item-total">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveItem(item.productId)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="cart-sidebar">
            <CartSummary cart={cart} />
            <button className="btn-primary checkout-btn" onClick={handleCheckout}>
              Proceed to Checkout
            </button>
            <button className="btn-secondary" onClick={handleClearCart}>
              Clear Cart
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
