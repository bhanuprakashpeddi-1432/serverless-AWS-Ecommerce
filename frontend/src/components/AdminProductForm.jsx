import { useState } from 'react'
import { productsApi } from '../services/api'
import './AdminProductForm.css'

const AdminProductForm = ({ onSuccess, onCancel, initialData = null }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || '',
    category: initialData?.category || '',
    stock: initialData?.stock || '',
    imageUrl: initialData?.imageUrl || '',
    imageKey: initialData?.imageKey || ''
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initialData?.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  const isEditMode = !!initialData

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size exceeds 10MB limit')
      return
    }

    setImageFile(file)
    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Upload image to S3 using presigned URL
  const uploadImageToS3 = async (file) => {
    try {
      setUploading(true)
      setUploadProgress(0)

      // Step 1: Get presigned URL from backend
      const presignedResponse = await productsApi.getPresignedUploadUrl({
        filename: file.name,
        contentType: file.type,
        fileSize: file.size
      })

      const { uploadUrl, key, fileUrl } = presignedResponse.data

      // Step 2: Upload file directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to S3')
      }

      setUploadProgress(100)
      return { key, fileUrl }

    } catch (err) {
      console.error('Error uploading image:', err)
      throw new Error(err.response?.data?.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.price || !formData.category || !formData.stock) {
        setError('Please fill in all required fields')
        setSubmitting(false)
        return
      }

      let imageKey = formData.imageKey
      let imageUrl = formData.imageUrl

      // Upload new image if selected
      if (imageFile) {
        const uploadResult = await uploadImageToS3(imageFile)
        imageKey = uploadResult.key
        imageUrl = uploadResult.fileUrl
      }

      // Prepare product payload
      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category: formData.category.trim(),
        stock: parseInt(formData.stock, 10),
        imageUrl: imageUrl,
        imageKey: imageKey,
        status: 'active'
      }

      // Call API to create or update product
      let response
      if (isEditMode) {
        response = await productsApi.update(initialData.id, productPayload)
      } else {
        response = await productsApi.create(productPayload)
      }

      console.log('Product saved successfully:', response.data)

      // Call success callback
      if (onSuccess) {
        onSuccess(response.data)
      }

      // Reset form if creating new product
      if (!isEditMode) {
        setFormData({
          name: '',
          description: '',
          price: '',
          category: '',
          stock: '',
          imageUrl: '',
          imageKey: ''
        })
        setImageFile(null)
        setImagePreview('')
      }

    } catch (err) {
      console.error('Error saving product:', err)
      setError(err.message || err.response?.data?.message || 'Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-product-form">
      <h2>{isEditMode ? 'Edit Product' : 'Add New Product'}</h2>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Product Name */}
        <div className="form-group">
          <label htmlFor="name">
            Product Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter product name"
            required
            disabled={submitting || uploading}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter product description"
            rows="4"
            disabled={submitting || uploading}
          />
        </div>

        {/* Price */}
        <div className="form-group">
          <label htmlFor="price">
            Price ($) <span className="required">*</span>
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
            disabled={submitting || uploading}
          />
        </div>

        {/* Category */}
        <div className="form-group">
          <label htmlFor="category">
            Category <span className="required">*</span>
          </label>
          <input
            type="text"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="e.g., Electronics, Clothing, Books"
            required
            disabled={submitting || uploading}
          />
        </div>

        {/* Stock */}
        <div className="form-group">
          <label htmlFor="stock">
            Stock Quantity <span className="required">*</span>
          </label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            placeholder="0"
            min="0"
            required
            disabled={submitting || uploading}
          />
        </div>

        {/* Image Upload */}
        <div className="form-group">
          <label htmlFor="image">Product Image</label>
          <input
            type="file"
            id="image"
            name="image"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            disabled={submitting || uploading}
          />
          <small className="form-text">
            Accepted formats: JPEG, PNG, GIF, WebP. Max size: 10MB
          </small>

          {/* Image Preview */}
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
            </div>
          )}

          {/* Upload Progress */}
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

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting || uploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || uploading}
          >
            {submitting ? 'Saving...' : uploading ? 'Uploading...' : isEditMode ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AdminProductForm
