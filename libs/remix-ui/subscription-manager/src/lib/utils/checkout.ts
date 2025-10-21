/**
 * Opens a popup window for Paddle checkout
 * @param priceId - Optional Paddle price ID for specific plan
 * @param ghId - GitHub user ID to store in localStorage
 * @param onRefresh - Callback to refresh subscription after checkout
 */
export const openCheckoutPopup = (
  priceId: string | undefined,
  ghId: string | null,
  onRefresh?: () => void
) => {
  console.log('🔵 openCheckoutPopup: priceId:', priceId, 'ghId:', ghId)
  
  // Store GitHub user data in localStorage for the popup
  // localStorage is shared across same-origin windows
  if (ghId) {
    window.localStorage.setItem('gh_id', ghId)
    console.log('✅ Stored gh_id in localStorage:', ghId)
  } else {
    console.warn('⚠️ No ghId available!')
  }
  
  // Calculate centered popup position
  const w = 900, h = 900
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : (window as any).screenX
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : (window as any).screenY
  const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth
  const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight
  const systemZoom = width / window.screen.availWidth
  const left = (width - w) / 2 / systemZoom + dualScreenLeft
  const top = (height - h) / 2 / systemZoom + dualScreenTop
  const features = `scrollbars=yes, width=${w / systemZoom}, height=${h / systemZoom}, top=${top}, left=${left}`
  
  // Build checkout URL
  const url = priceId 
    ? `${window.location.origin}/#source=subscription-checkout&priceId=${priceId}`
    : `${window.location.origin}/#source=subscription-checkout`
  
  console.log('🔵 Opening popup with URL:', url)
  
  const popup = window.open(url, 'remix-pro-subscribe', features)
  
  if (popup) {
    console.log('✅ Popup window opened successfully')
    
    // Check if popup was closed and refresh subscription
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        console.log('🔵 Popup closed, refreshing subscription...')
        clearInterval(checkClosed)
        
        if (ghId && onRefresh) {
          setTimeout(() => {
            console.log('🔵 Calling onRefresh callback')
            onRefresh()
          }, 1000) // Wait 1 second for Paddle to process
        } else {
          console.warn('⚠️ Cannot refresh subscription, ghId or onRefresh not available')
        }
      }
    }, 1000)
  } else {
    console.error('❌ Failed to open popup (might be blocked)')
  }
}
