/**
 * Securely checks if a password has been compromised in data breaches
 * using the k-Anonymity model with Have I Been Pwned API.
 * 
 * Only the first 5 characters of the SHA-1 hash are sent to the API,
 * ensuring the password itself is never transmitted.
 */
export async function checkPasswordCompromised(password: string): Promise<number> {
  if (!password) return 0

  // 1. Calculate SHA-1 hash of the password locally
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await window.crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()

  // 2. Split hash into prefix (first 5 chars) and suffix (the rest)
  const prefix = hashHex.substring(0, 5)
  const suffix = hashHex.substring(5)

  try {
    // 3. Send ONLY the prefix to the HIBP API (k-Anonymity)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
    
    if (!response.ok) {
        console.warn('Failed to contact HaveIBeenPwned API', response.status)
        return 0
    }

    const text = await response.text()
    
    // 4. Check if our suffix is in the returned list of compromised suffixes
    const lines = text.split('\n')
    for (const line of lines) {
      const [lineSuffix, countStr] = line.split(':')
      if (lineSuffix.trim() === suffix) {
        return parseInt(countStr.trim(), 10) || 0
      }
    }

    return 0 // Password not found in known breaches
  } catch (err) {
    console.error('Error checking password compromise status:', err)
    return 0
  }
}
