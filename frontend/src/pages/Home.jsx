import { useState, useEffect } from 'react'
import { productsApi } from '../services/api'
import ProductCard from '../components/ProductCard'
import './Home.css'

function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await productsApi.getAll()
      setProducts(response.data)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError('Failed to load products. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading products...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="home">
      <h1>Our Products</h1>
      <div className="products-grid">
        {products.length === 0 ? (
          <p>No products available at the moment.</p>
        ) : (
          products.map((product) => (
            <ProductCard key={product.productId || product.id} product={product} />
          ))
        )}
      </div>
    </div>
  )
}

export default Home
