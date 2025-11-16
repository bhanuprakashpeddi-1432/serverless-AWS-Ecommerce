import { createContext, useContext, useState, useEffect } from 'react'
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js'
import { COGNITO_CONFIG } from '../config/env'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize Cognito User Pool
  const userPool = COGNITO_CONFIG.userPoolId ? new CognitoUserPool({
    UserPoolId: COGNITO_CONFIG.userPoolId,
    ClientId: COGNITO_CONFIG.clientId,
  }) : null

  useEffect(() => {
    // Check if user is already logged in
    checkAuth()
  }, [])

  const checkAuth = () => {
    try {
      if (!userPool) {
        setLoading(false)
        return
      }

      const cognitoUser = userPool.getCurrentUser()
      if (cognitoUser) {
        cognitoUser.getSession((err, session) => {
          if (err) {
            console.error('Error getting session:', err)
            setLoading(false)
            return
          }

          if (session.isValid()) {
            cognitoUser.getUserAttributes((err, attributes) => {
              if (err) {
                console.error('Error getting attributes:', err)
                setLoading(false)
                return
              }

              const userData = {}
              attributes.forEach((attr) => {
                userData[attr.Name] = attr.Value
              })

              // Get groups from ID token
              const idToken = session.getIdToken()
              const groups = idToken.payload['cognito:groups'] || []

              setUser({
                username: cognitoUser.getUsername(),
                email: userData.email,
                given_name: userData.given_name,
                family_name: userData.family_name,
                name: userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`.trim(),
                groups: groups,
                isAdmin: groups.includes('Admins'),
              })

              // Store tokens in localStorage
              const accessToken = session.getAccessToken().getJwtToken()
              const idTokenJwt = session.getIdToken().getJwtToken()
              const refreshToken = session.getRefreshToken().getToken()
              
              localStorage.setItem('accessToken', accessToken)
              localStorage.setItem('idToken', idTokenJwt)
              localStorage.setItem('refreshToken', refreshToken)
            })
          } else {
            // Session expired, clear tokens
            clearTokens()
          }
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setLoading(false)
    }
  }

  const clearTokens = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('idToken')
    localStorage.removeItem('refreshToken')
  }

  const signIn = (email, password) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const accessToken = result.getAccessToken().getJwtToken()
          const idToken = result.getIdToken().getJwtToken()
          const refreshToken = result.getRefreshToken().getToken()
          
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('idToken', idToken)
          localStorage.setItem('refreshToken', refreshToken)
          
          checkAuth()
          resolve(result)
        },
        onFailure: (err) => {
          console.error('Sign in error:', err)
          setError(err.message || 'Failed to sign in')
          reject(err)
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Handle new password required challenge
          reject(new Error('New password required'))
        },
      })
    })
  }

  const signUp = (email, password, givenName, familyName) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: 'given_name',
          Value: givenName,
        }),
        new CognitoUserAttribute({
          Name: 'family_name',
          Value: familyName,
        }),
      ]

      userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
          console.error('Sign up error:', err)
          setError(err.message || 'Failed to sign up')
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  const confirmSignUp = (email, code) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          console.error('Confirmation error:', err)
          setError(err.message || 'Failed to confirm sign up')
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  const resendConfirmationCode = (email) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          console.error('Resend code error:', err)
          setError(err.message || 'Failed to resend confirmation code')
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  const forgotPassword = (email) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.forgotPassword({
        onSuccess: (result) => {
          resolve(result)
        },
        onFailure: (err) => {
          console.error('Forgot password error:', err)
          setError(err.message || 'Failed to initiate password reset')
          reject(err)
        },
      })
    })
  }

  const confirmPassword = (email, code, newPassword) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve()
        },
        onFailure: (err) => {
          console.error('Confirm password error:', err)
          setError(err.message || 'Failed to reset password')
          reject(err)
        },
      })
    })
  }

  const changePassword = (oldPassword, newPassword) => {
    return new Promise((resolve, reject) => {
      setError(null)
      
      if (!userPool) {
        const error = new Error('Cognito not configured')
        setError(error.message)
        reject(error)
        return
      }

      const cognitoUser = userPool.getCurrentUser()
      
      if (!cognitoUser) {
        const error = new Error('No user logged in')
        setError(error.message)
        reject(error)
        return
      }

      cognitoUser.getSession((err, session) => {
        if (err) {
          setError(err.message)
          reject(err)
          return
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            console.error('Change password error:', err)
            setError(err.message || 'Failed to change password')
            reject(err)
            return
          }
          resolve(result)
        })
      })
    })
  }

  const signOut = () => {
    if (userPool) {
      const cognitoUser = userPool.getCurrentUser()
      if (cognitoUser) {
        cognitoUser.signOut()
      }
    }
    clearTokens()
    setUser(null)
    setError(null)
  }

  const getAccessToken = () => {
    return localStorage.getItem('accessToken')
  }

  const getIdToken = () => {
    return localStorage.getItem('idToken')
  }

  const refreshSession = () => {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error('Cognito not configured'))
        return
      }

      const cognitoUser = userPool.getCurrentUser()
      
      if (!cognitoUser) {
        reject(new Error('No user logged in'))
        return
      }

      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err)
          return
        }

        if (!session.isValid()) {
          const refreshToken = session.getRefreshToken()
          cognitoUser.refreshSession(refreshToken, (err, newSession) => {
            if (err) {
              console.error('Refresh session error:', err)
              signOut()
              reject(err)
              return
            }

            const accessToken = newSession.getAccessToken().getJwtToken()
            const idToken = newSession.getIdToken().getJwtToken()
            
            localStorage.setItem('accessToken', accessToken)
            localStorage.setItem('idToken', idToken)
            
            resolve(newSession)
          })
        } else {
          resolve(session)
        }
      })
    })
  }

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    resendConfirmationCode,
    forgotPassword,
    confirmPassword,
    changePassword,
    checkAuth,
    getAccessToken,
    getIdToken,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
