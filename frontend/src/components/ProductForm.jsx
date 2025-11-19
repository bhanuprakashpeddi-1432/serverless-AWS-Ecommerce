import { useState } from 'react'
import { productsApi } from '../services/api'
import './ProductForm.css'

/**
 * Product Form with validation and image upload
 */
export function ProductForm({ product, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    stock: product?.stock?.toString() || '',
    category: product?.category || '',
    imageUrl: product?.imageUrl || '',
    imageKey: product?.imageKey || '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  /**
   * Validate form fields
   */
  const validateForm = () => {
    const newErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required'
    } else if (formData.name.length < 3) {
      newErrors.name = 'Product name must be at least 3 characters'
    } else if (formData.name.length > 200) {
      newErrors.name = 'Product name must be less than 200 characters'
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    } else if (formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters'
    }

    // Price validation
    const price = parseFloat(formData.price)
    if (!formData.price) {
      newErrors.price = 'Price is required'
    } else if (isNaN(price)) {
      newErrors.price = 'Price must be a valid number'
    } else if (price < 0) {
      newErrors.price = 'Price cannot be negative'
    } else if (price > 999999.99) {
      newErrors.price = 'Price cannot exceed $999,999.99'
    }

    // Stock validation
    const stock = parseInt(formData.stock)
    if (!formData.stock) {
      newErrors.stock = 'Stock quantity is required'
    } else if (isNaN(stock)) {
      newErrors.stock = 'Stock must be a valid number'
    } else if (stock < 0) {
      newErrors.stock = 'Stock cannot be negative'
    } else if (stock > 999999) {
      newErrors.stock = 'Stock cannot exceed 999,999'
    }

    // Category validation (optional but if provided, validate)
    if (formData.category && formData.category.length > 100) {
      newErrors.category = 'Category must be less than 100 characters'
    }

    // Image validation (only if file selected)
    if (imageFile) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(imageFile.type)) {
        newErrors.image = 'Image must be JPEG, PNG, GIF, or WebP'
      }
      if (imageFile.size > 10 * 1024 * 1024) {
        newErrors.image = 'Image size must be less than 10MB'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Handle form field changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }))
    }
  }

  /**
   * Handle image file selection
   */
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        image: 'Image must be JPEG, PNG, GIF, or WebP'
      }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        image: 'Image size must be less than 10MB'
      }))
      return
    }

    setImageFile(file)
    
    // Clear image error
    if (errors.image) {
      setErrors(prev => ({
        ...prev,
        image: null
      }))
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  /**
   * Upload image to S3 via presigned URL
   */
  const uploadImageToS3 = async (file) => {
    try {
      setUploading(true)
      setUploadProgress(10)

      // Get presigned URL
      const response = await productsApi.getPresignedUploadUrl({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      })

      setUploadProgress(30)

      const { uploadUrl, key, fileUrl } = response.data

      // Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      setUploadProgress(80)

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to S3')
      }

      setUploadProgress(100)

      return { imageKey: key, imageUrl: fileUrl }
    } catch (error) {
      console.error('Error uploading image:', error)
      throw new Error('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)

      let imageData = {
        imageKey: formData.imageKey,
        imageUrl: formData.imageUrl
      }

      // Upload image if new file selected
      if (imageFile) {
        imageData = await uploadImageToS3(imageFile)
      }

      // Prepare product data
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        category: formData.category.trim() || undefined,
        imageKey: imageData.imageKey || undefined,
        imageUrl: imageData.imageUrl || undefined,
        status: 'active'
      }

      // Create or update product
      if (product) {
        await productsApi.update(product.productId, productData)
      } else {
        await productsApi.create(productData)
      }

      // Success callback
      onSuccess && onSuccess()
    } catch (error) {
      console.error('Error saving product:', error)
      
      // Set error message
      setErrors({
        submit: error.response?.data?.message || error.message || 'Failed to save product'
      })
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Clear image selection
   */
  const handleClearImage = () => {
    setImageFile(null)
    setImagePreview(product?.imageUrl || '')
    setErrors(prev => ({
      ...prev,
      image: null
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="product-form">
      <h2>{product ? 'Edit Product' : 'Add New Product'}</h2>

      {errors.submit && (
        <div className="error-banner">
          {errors.submit}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name">
          Product Name <span className="required">*</span>
        </label>
        <input
          id="name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={errors.name ? 'error' : ''}
          placeholder="Enter product name"
          maxLength={200}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="description">
          Description <span className="required">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className={errors.description ? 'error' : ''}
          placeholder="Enter product description"
          rows={4}
          maxLength={2000}
        />
        <div className="char-count">
          {formData.description.length} / 2000
        </div>
        {errors.description && <span className="error-text">{errors.description}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="price">
            Price ($) <span className="required">*</span>
          </label>
          <input
            id="price"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            className={errors.price ? 'error' : ''}
            placeholder="0.00"
            step="0.01"
            min="0"
            max="999999.99"
          />
          {errors.price && <span className="error-text">{errors.price}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="stock">
            Stock Quantity <span className="required">*</span>
          </label>
          <input
            id="stock"
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            className={errors.stock ? 'error' : ''}
            placeholder="0"
            min="0"
            max="999999"
          />
          {errors.stock && <span className="error-text">{errors.stock}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <input
          id="category"
          type="text"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className={errors.category ? 'error' : ''}
          placeholder="e.g., Electronics, Clothing"
          maxLength={100}
        />
        {errors.category && <span className="error-text">{errors.category}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="image">Product Image</label>
        <div className="image-upload-container">
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                type="button"
                className="btn-clear-image"
                onClick={handleClearImage}
                disabled={uploading}
              >
                ×
              </button>
            </div>
          )}
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            className={errors.image ? 'error' : ''}
            disabled={uploading}
          />
          <div className="upload-help">
            Accepted formats: JPEG, PNG, GIF, WebP (max 10MB)
          </div>
          {errors.image && <span className="error-text">{errors.image}</span>}
          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span>Uploading... {uploadProgress}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button 
          type="submit" 
          className="btn-primary"
          disabled={submitting || uploading}
        >
          {submitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </button>
        <button 
          type="button" 
          className="btn-secondary" 
          onClick={onCancel}
          disabled={submitting || uploading}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default ProductForm
