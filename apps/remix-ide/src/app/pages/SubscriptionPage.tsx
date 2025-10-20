import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import '../components/styles/preload.css'
import { endpointUrls } from "@remix-endpoints-helper"

declare global {
  interface Window {
    Paddle?: any
  }
}

const logo = (
  <svg id="Ebene_2" data-name="Ebene 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 100">
    <path d="M91.84,35a.09.09,0,0,1-.1-.07,41,41,0,0,0-79.48,0,.09.09,0,0,1-.1.07C9.45,35,1,35.35,1,42.53c0,8.56,1,16,6,20.32,2.16,1.85,5.81,2.3,9.27,2.22a44.4,44.4,0,0,0,6.45-.68.09.09,0,0,0,.06-.15A34.81,34.81,0,0,1,17,45c0-.1,0-.21,0-.31a35,35,0,0,1,70,0c0,.10,0,.21,0,.31a34.81,34.81,0,0,1-5.78,19.24.09.09,0,0,0,.06.15,44.4,44.4,0,0,0,6.45.68c3.46.08,7.11-.37,9.27-2.22,5-4.27,6-11.76,6-20.32C103,35.35,94.55,35,91.84,35Z" />
    <path d="M52,74,25.4,65.13a.1.1,0,0,0-.1.17L51.93,91.93a.1.1,0,0,0,.14,0L78.7,65.3a.1.1,0,0,0-.1-.17L52,74A.06.06,0,0,1,52,74Z" />
    <path d="M75.68,46.9,82,45a.09.09,0,0,0,.08-.09,29.91,29.91,0,0,0-.87-6.94.11.11,0,0,0-.09-.08l-6.43-.58a.1.1,0,0,1-.06-.18l4.78-4.18a.13.13,0,0,0,0-.12,30.19,30.19,0,0,0-3.65-6.07.09.09,0,0,0-.11,0l-5.91,2a.1.1,0,0,1-.12-.14L72.19,23a.11.11,0,0,0,0-.12,29.86,29.86,0,0,0-5.84-4.13.09.09,0,0,0-.11,0l-4.47,4.13a.1.1,0,0,1-.17-.07l.09-6a.1.1,0,0,0-.07-.1,30.54,30.54,0,0,0-7-1.47.1.1,0,0,0-.1.07l-2.38,5.54a.1.1,0,0,1-.18,0l-2.37-5.54a.11.11,0,0,0-.11-.06,30,30,0,0,0-7,1.48.12.12,0,0,0-.07.1l.08,6.05a.09.09,0,0,1-.16.07L37.8,18.76a.11.11,0,0,0-.12,0,29.75,29.75,0,0,0-5.83,4.13.11.11,0,0,0,0,.12l2.59,5.6a.11.11,0,0,1-.13.14l-5.9-2a.11.11,0,0,0-.12,0,30.23,30.23,0,0,0-3.62,6.08.11.11,0,0,0,0,.12l4.79,4.19a.1.1,0,0,1-.06.17L23,37.91a.1.1,0,0,0-.09.07A29.9,29.9,0,0,0,22,44.92a.1.1,0,0,0,.07.1L28.4,47a.1.1,0,0,1,0,.18l-5.84,3.26a.16.16,0,0,0,0,.11,30.17,30.17,0,0,0,2.1,6.76c.32.71.67,1.4,1,2.08a.1.1,0,0,0,.06,0L52,68.16H52l26.34-8.78a.1.1,0,0,0,.06-.05,30.48,30.48,0,0,0,3.11-8.88.1.1,0,0,0-.05-.11l-5.83-3.26A.1.1,0,0,1,75.68,46.9Z" />
  </svg>
)

export const SubscriptionPage = () => {
  const hasInitialized = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const initPaddle = async () => {
      try {
        // Load Paddle.js script
        if (!window.Paddle) {
          const script = document.createElement('script')
          script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
          script.async = true
          document.head.appendChild(script)
          
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load Paddle.js'))
          })
        }

        // Initialize Paddle (sandbox mode for testing)
        window.Paddle.Environment.set('sandbox')
        window.Paddle.Initialize({
          token: 'test_aa605484fa99283bb809c6fba32'
        })

        // Get GitHub user data from localStorage (set by topbar before opening popup)
        const ghLogin = window.localStorage.getItem('gh_login') || 'user'
        const ghId = window.localStorage.getItem('gh_id') || '0'
        const ghEmail = window.localStorage.getItem('gh_email') || `${ghLogin}@users.noreply.github.com`

        // Validate we have a real GitHub ID
        if (ghId === '0' || !ghId) {
          throw new Error('Please log in with GitHub first')
        }

        // Create checkout transaction via backend
        const { data } = await axios.post(`${endpointUrls.billing}/checkout`, {
          customerEmail: ghEmail,
          customData: { ghId }
        })

        if (!data?.id) {
          throw new Error('Failed to create transaction')
        }

        const transactionId = data.id
        
        // Open Paddle checkout overlay
        window.Paddle.Checkout.open({
          transactionId,
          settings: {
            displayMode: 'overlay',
            theme: 'dark',
            locale: 'en'
          },
          eventCallback: (event: any) => {
            console.log('Paddle event:', event)
            if (event.name === 'checkout.completed') {
              // Checkout completed successfully
              setLoading(false)
              setSuccess(true)
              
              // Notify parent window about subscription change
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'SUBSCRIPTION_COMPLETED',
                  ghId 
                }, window.location.origin)
              }
              
              // Close the window after 2 seconds
              setTimeout(() => {
                window.close()
              }, 2000)
            } else if (event.name === 'checkout.closed') {
              // User closed checkout without completing
              window.close()
            }
          }
        })

        setLoading(false)
      } catch (err: any) {
        console.error('Paddle initialization error:', err)
        setError(err?.message || 'Failed to initialize checkout')
        setLoading(false)
      }
    }

    initPaddle()
  }, [])

  return (
    <div className="preload-container">
      <div className="preload-logo pb-4">
        {logo}
        <div>
          {loading && (
            <div className='text-center'>
              <i className="fas fa-spinner fa-spin fa-2x"></i>
              <p className="mt-3">Loading checkout...</p>
            </div>
          )}
          {success && (
            <div className='text-center text-success'>
              <i className="fas fa-check-circle fa-2x"></i>
              <p className="mt-3">Subscription activated! 🎉</p>
              <p className="text-muted small">This window will close automatically...</p>
            </div>
          )}
          {error && (
            <div className='text-center text-danger'>
              <i className="fas fa-exclamation-triangle fa-2x"></i>
              <p className="mt-3">{error}</p>
              <button className="btn btn-primary mt-2" onClick={() => window.close()}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
