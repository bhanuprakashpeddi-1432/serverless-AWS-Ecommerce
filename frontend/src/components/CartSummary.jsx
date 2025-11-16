import './CartSummary.css'

function CartSummary({ cart }) {
  const items = cart?.items || []
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.1 // 10% tax
  const shipping = subtotal > 50 ? 0 : 10
  const total = subtotal + tax + shipping

  return (
    <div className="cart-summary">
      <h3>Order Summary</h3>
      <div className="summary-row">
        <span>Subtotal:</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>Tax (10%):</span>
        <span>${tax.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>Shipping:</span>
        <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
      </div>
      <div className="summary-divider"></div>
      <div className="summary-row total">
        <span>Total:</span>
        <span>${total.toFixed(2)}</span>
      </div>
      {subtotal < 50 && subtotal > 0 && (
        <p className="shipping-notice">
          Add ${(50 - subtotal).toFixed(2)} more for free shipping!
        </p>
      )}
    </div>
  )
}

export default CartSummary
