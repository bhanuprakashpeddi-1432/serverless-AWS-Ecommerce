import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import './CartWidget.css'

const CartWidget = () => {
  const { totalItems, totalPrice, loading } = useCart()

  return (
    <Link
      to="/cart"
      className="cart-widget"
      aria-label={`Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}, total ${loading ? 'loading' : `$${totalPrice.toFixed(2)}`}`}
    >
      <div className="cart-icon" aria-hidden="true">
        🛒
        {totalItems > 0 && (
          <span className="cart-badge" aria-hidden="true">{totalItems}</span>
        )}
      </div>
      <div className="cart-info">
        <span className="cart-total" aria-live="polite" aria-atomic="true">
          ${loading ? '...' : totalPrice.toFixed(2)}
        </span>
      </div>
    </Link>
  )
}

export default CartWidget
