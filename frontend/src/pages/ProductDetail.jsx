import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { productsApi, cartApi } from '../services/api'
import './ProductDetail.css'

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await productsApi.getById(id)
      // API returns product object directly or { product: {...} }
      const productData = response.data.product || response.data
      setProduct(productData)
    } catch (err) {
      console.error('Error fetching product:', err)
      setError('Failed to load product details.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    try {
      setAddingToCart(true)
      await cartApi.addItem({
        productId: id,
        quantity: quantity,
      })
      alert('Product added to cart!')
      navigate('/cart')
    } catch (err) {
      console.error('Error adding to cart:', err)
      alert('Failed to add product to cart.')
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) return <div className="loading">Loading product...</div>
  if (error) return <div className="error">{error}</div>
  if (!product) return <div className="error">Product not found</div>

  return (
    <div className="product-detail">
      <button onClick={() => navigate('/')} className="back-btn">
        ← Back to Products
      </button>
      <div className="product-detail-content">
        <div className="product-image">
          <img 
            src={product.imageUrl || 'https://via.placeholder.com/400'} 
            alt={product.name} 
          />
        </div>
        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="product-price">${product.price?.toFixed(2)}</p>
          <p className="product-description">{product.description}</p>
          <p className="product-stock">
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </p>
          <div className="quantity-selector">
            <label htmlFor="quantity">Quantity:</label>
            <input
              type="number"
              id="quantity"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
          <button
            className="btn-primary add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={product.stock === 0 || addingToCart}
          >
            {addingToCart ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
