import { useState, useEffect } from 'react'
import { productsApi } from '../services/api'
import { ProductForm } from '../components/ProductForm'
import { useAuth } from '../components/AuthProvider'
import './Admin.css'

function Admin() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [sortBy, setSortBy] = useState('name')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await productsApi.getAll()
      // API returns { products: [...], count: N }
      setProducts(response.data.products || response.data.items || response.data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err.response?.data?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingProduct(null)
    setShowForm(true)
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingProduct(null)
    fetchProducts()
  }

  const handleDelete = async (product) => {
    const confirmMessage = `Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`
    
    if (window.confirm(confirmMessage)) {
      try {
        await productsApi.delete(product.productId)
        fetchProducts()
      } catch (err) {
        console.error('Error deleting product:', err)
        alert(err.response?.data?.message || 'Failed to delete product.')
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  // Filter and sort products
  const getFilteredProducts = () => {
    let filtered = [...products]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      )
    }

    // Category filter
    if (filterCategory) {
      filtered = filtered.filter(p => p.category === filterCategory)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'price-asc':
          return (a.price || 0) - (b.price || 0)
        case 'price-desc':
          return (b.price || 0) - (a.price || 0)
        case 'stock-asc':
          return (a.stock || 0) - (b.stock || 0)
        case 'stock-desc':
          return (b.stock || 0) - (a.stock || 0)
        default:
          return 0
      }
    })

    return filtered
  }

  const filteredProducts = getFilteredProducts()
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  return (
    <div className="admin">
      <div className="admin-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <p className="welcome-text">Welcome, {user?.name || user?.email}</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleAddNew}
          disabled={showForm}
        >
          + Add Product
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <ProductForm
              product={editingProduct}
              onSuccess={handleFormSuccess}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}

      <div className="products-section">
        <div className="products-header">
          <h2>Products ({filteredProducts.length})</h2>
          
          <div className="products-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Name (A-Z)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="stock-asc">Stock (Low to High)</option>
              <option value="stock-desc">Stock (High to Low)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>No products found</p>
            {searchTerm || filterCategory ? (
              <button 
                className="btn-secondary"
                onClick={() => {
                  setSearchTerm('')
                  setFilterCategory('')
                }}
              >
                Clear Filters
              </button>
            ) : (
              <button className="btn-primary" onClick={handleAddNew}>
                Add Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className="products-table">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.productId}>
                    <td>
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="product-thumbnail"
                        />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                    </td>
                    <td>
                      <div className="product-name">{product.name}</div>
                      <div className="product-id">ID: {product.productId}</div>
                    </td>
                    <td className="price-cell">${product.price?.toFixed(2)}</td>
                    <td className={product.stock < 10 ? 'low-stock' : ''}>
                      {product.stock}
                      {product.stock < 10 && product.stock > 0 && (
                        <span className="stock-warning"> ⚠️</span>
                      )}
                      {product.stock === 0 && (
                        <span className="stock-warning"> ❌</span>
                      )}
                    </td>
                    <td>{product.category || '-'}</td>
                    <td>
                      <span className={`status-badge ${product.status || 'active'}`}>
                        {product.status || 'active'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(product)}
                        disabled={showForm}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(product)}
                        disabled={showForm}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Admin
