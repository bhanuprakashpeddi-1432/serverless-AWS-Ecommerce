import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '../services/api'
import './Checkout.css'

function Checkout() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await ordersApi.create({
        shippingAddress: {
          fullName: formData.fullName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        },
        paymentMethod: {
          type: 'card',
          // In production, use a payment processor like Stripe
          last4: formData.cardNumber.slice(-4),
        },
      })
      
      alert('Order placed successfully!')
      navigate(`/orders/${response.data.orderId}`)
    } catch (err) {
      console.error('Error placing order:', err)
      alert('Failed to place order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="checkout">
      <h1 id="checkout-title">Checkout</h1>
      <form onSubmit={handleSubmit} className="checkout-form" aria-labelledby="checkout-title" noValidate>
        <section className="form-section">
          <h2>Contact Information</h2>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
              aria-required="true"
            />
          </div>
        </section>

        <section className="form-section">
          <h2>Shipping Address</h2>
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              autoComplete="name"
              required
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              autoComplete="street-address"
              required
              aria-required="true"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                autoComplete="address-level2"
                required
                aria-required="true"
              />
            </div>
            <div className="form-group">
              <label htmlFor="state">State</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                autoComplete="address-level1"
                required
                aria-required="true"
              />
            </div>
            <div className="form-group">
              <label htmlFor="zipCode">ZIP Code</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                inputMode="numeric"
                autoComplete="postal-code"
                required
                aria-required="true"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Payment Information</h2>
          <div className="form-group">
            <label htmlFor="cardNumber">Card Number</label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={formData.cardNumber}
              onChange={handleChange}
              placeholder="1234 5678 9012 3456"
              inputMode="numeric"
              autoComplete="cc-number"
              required
              aria-required="true"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expiryDate">Expiry Date</label>
              <input
                type="text"
                id="expiryDate"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                placeholder="MM/YY"
                autoComplete="cc-exp"
                required
                aria-required="true"
              />
            </div>
            <div className="form-group">
              <label htmlFor="cvv">CVV</label>
              <input
                type="text"
                id="cvv"
                name="cvv"
                value={formData.cvv}
                onChange={handleChange}
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
                aria-required="true"
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          className="btn-primary submit-btn"
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={loading || undefined}
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </form>
    </div>
  )
}

export default Checkout
