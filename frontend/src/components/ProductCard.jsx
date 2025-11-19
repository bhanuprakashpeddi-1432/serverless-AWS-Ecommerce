import { Link } from 'react-router-dom'
import './ProductCard.css'

function ProductCard({ product }) {
  return (
    <Link
      to={`/products/${product.productId || product.id}`}
      className="product-card"
      aria-label={`View details for ${product.name} priced at $${product.price?.toFixed(2)}`}
    >
      <div className="product-image">
        <img 
          src={product.imageUrl || 'https://via.placeholder.com/300'} 
          alt={`${product.name} — ${product.category || 'product'}`}
          loading="lazy"
          width="300"
          height="225"
        />
      </div>
      <div className="product-details">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">
          {product.description?.length > 100 
            ? `${product.description.substring(0, 100)}...` 
            : product.description}
        </p>
        <div className="product-footer">
          <span className="product-price">${product.price?.toFixed(2)}</span>
          <span className="product-stock">
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
