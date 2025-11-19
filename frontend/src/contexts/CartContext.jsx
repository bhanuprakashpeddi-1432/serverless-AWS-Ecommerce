import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { cartApi } from '../services/api'

const CartContext = createContext(null)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({
    items: [],
    itemCount: 0,
    totalItems: 0,
    totalPrice: 0,
    lastUpdated: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch cart from backend
  const fetchCart = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await cartApi.get()
      
      setCart({
        items: response.data.items || [],
        itemCount: response.data.itemCount || 0,
        totalItems: response.data.totalItems || 0,
        totalPrice: response.data.totalPrice || 0,
        lastUpdated: response.data.lastUpdated || null
      })
      
      setIsInitialized(true)
    } catch (err) {
      console.error('Error fetching cart:', err)
      
      // If unauthorized or cart doesn't exist, initialize empty cart
      if (err.response?.status === 401 || err.response?.status === 404) {
        setCart({
          items: [],
          itemCount: 0,
          totalItems: 0,
          totalPrice: 0,
          lastUpdated: null
        })
        setIsInitialized(true)
      } else {
        setError(err.response?.data?.message || 'Failed to load cart')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Add item to cart
  const addItem = useCallback(async (productId, quantity = 1) => {
    try {
      setLoading(true)
      setError(null)

      const response = await cartApi.addItem({
        productId,
        quantity
      })

      // Update local cart state
      const updatedItem = response.data.item

      setCart(prev => {
        const existingItemIndex = prev.items.findIndex(
          item => item.productId === productId
        )

        let newItems
        if (existingItemIndex >= 0) {
          // Update existing item
          newItems = [...prev.items]
          newItems[existingItemIndex] = updatedItem
        } else {
          // Add new item
          newItems = [...prev.items, updatedItem]
        }

        // Recalculate totals
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalPrice = newItems.reduce(
          (sum, item) => sum + (item.productPrice * item.quantity),
          0
        )

        return {
          items: newItems,
          itemCount: newItems.length,
          totalItems,
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          lastUpdated: updatedItem.updatedAt
        }
      })

      return response.data
    } catch (err) {
      console.error('Error adding item to cart:', err)
      const errorMessage = err.response?.data?.message || 'Failed to add item to cart'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Update item quantity
  const updateItem = useCallback(async (productId, quantity) => {
    try {
      setLoading(true)
      setError(null)

      const response = await cartApi.updateItem(productId, { quantity })
      const updatedItem = response.data.item

      // Update local cart state
      setCart(prev => {
        const newItems = prev.items.map(item =>
          item.productId === productId ? updatedItem : item
        )

        // Recalculate totals
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalPrice = newItems.reduce(
          (sum, item) => sum + (item.productPrice * item.quantity),
          0
        )

        return {
          items: newItems,
          itemCount: newItems.length,
          totalItems,
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          lastUpdated: updatedItem.updatedAt
        }
      })

      return response.data
    } catch (err) {
      console.error('Error updating cart item:', err)
      const errorMessage = err.response?.data?.message || 'Failed to update cart item'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Remove item from cart
  const removeItem = useCallback(async (productId) => {
    try {
      setLoading(true)
      setError(null)

      await cartApi.removeItem(productId)

      // Update local cart state
      setCart(prev => {
        const newItems = prev.items.filter(item => item.productId !== productId)

        // Recalculate totals
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalPrice = newItems.reduce(
          (sum, item) => sum + (item.productPrice * item.quantity),
          0
        )

        return {
          items: newItems,
          itemCount: newItems.length,
          totalItems,
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          lastUpdated: new Date().toISOString()
        }
      })
    } catch (err) {
      console.error('Error removing item from cart:', err)
      const errorMessage = err.response?.data?.message || 'Failed to remove item from cart'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear entire cart
  const clearCart = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await cartApi.clear()

      // Reset cart state
      setCart({
        items: [],
        itemCount: 0,
        totalItems: 0,
        totalPrice: 0,
        lastUpdated: new Date().toISOString()
      })
    } catch (err) {
      console.error('Error clearing cart:', err)
      const errorMessage = err.response?.data?.message || 'Failed to clear cart'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Get item quantity in cart
  const getItemQuantity = useCallback((productId) => {
    const item = cart.items.find(item => item.productId === productId)
    return item ? item.quantity : 0
  }, [cart.items])

  // Check if item is in cart
  const isInCart = useCallback((productId) => {
    return cart.items.some(item => item.productId === productId)
  }, [cart.items])

  // Increment item quantity
  const incrementItem = useCallback(async (productId) => {
    const currentQuantity = getItemQuantity(productId)
    if (currentQuantity > 0) {
      await updateItem(productId, currentQuantity + 1)
    } else {
      await addItem(productId, 1)
    }
  }, [getItemQuantity, updateItem, addItem])

  // Decrement item quantity
  const decrementItem = useCallback(async (productId) => {
    const currentQuantity = getItemQuantity(productId)
    if (currentQuantity > 1) {
      await updateItem(productId, currentQuantity - 1)
    } else if (currentQuantity === 1) {
      await removeItem(productId)
    }
  }, [getItemQuantity, updateItem, removeItem])

  // Initialize cart on mount (if user is authenticated)
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token && !isInitialized) {
      fetchCart()
    } else if (!token) {
      setIsInitialized(true)
    }
  }, [fetchCart, isInitialized])

  const value = {
    // State
    cart,
    loading,
    error,
    isInitialized,
    
    // Actions
    fetchCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    incrementItem,
    decrementItem,
    
    // Utilities
    getItemQuantity,
    isInCart,
    
    // Computed values
    isEmpty: cart.itemCount === 0,
    itemCount: cart.itemCount,
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export default CartContext
