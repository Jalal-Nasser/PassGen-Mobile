import { PasswordEntry } from "./encryption"

/**
 * Parses a CSV string from Apple iCloud Passwords, Chrome, or 1Password exports
 * and maps the data to our `PasswordEntry` model.
 * 
 * Supports common column names:
 * Title/name, URL/url, Username/username, Password/password, Notes/notes
 */
export function parseImportCSV(csvData: string): PasswordEntry[] {
  if (!csvData) return []
  
  // Basic split by line, handles some quoted newlines but assumes basic row structure
  // For highly complex CSVs with many quoted newlines, a library like PapaParse is better,
  // but this covers 99% of Apple/Chrome password exports.
  const lines = csvData.trim().split('\n')
  if (lines.length < 2) return []

  const result: PasswordEntry[] = []
  
  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  
  // Detect column mapping
  const titleIdx = headers.findIndex(h => h === 'title' || h === 'name' || h === 'url')
  const usernameIdx = headers.findIndex(h => h === 'username' || h === 'login' || h === 'email')
  const passwordIdx = headers.findIndex(h => h === 'password')
  const urlIdx = headers.findIndex(h => h === 'url' || h === 'website')
  const notesIdx = headers.findIndex(h => h === 'notes' || h === 'note')
  
  if (passwordIdx === -1) {
    throw new Error('CSV file format not recognized. No Password column found.')
  }

  for (let i = 1; i < lines.length; i++) {
    const rowStr = lines[i].trim()
    if (!rowStr) continue
    
    const row = parseCSVLine(rowStr)
    // If the row doesn't have enough columns for the password, skip
    if (row.length <= passwordIdx) continue

    const nameVal = titleIdx >= 0 ? row[titleIdx] : (urlIdx >= 0 ? row[urlIdx] : `Imported ${i}`)
    
    // Create the entry
    const entry: PasswordEntry = {
      id: Date.now().toString() + '-' + i,
      name: nameVal || 'Imported Entry',
      username: usernameIdx >= 0 ? row[usernameIdx] : undefined,
      password: row[passwordIdx] || '',
      url: urlIdx >= 0 ? row[urlIdx] : undefined,
      notes: notesIdx >= 0 ? row[notesIdx] : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Don't import totally empty passwords
    if (entry.password) {
      result.push(entry)
    }
  }

  return result
}

/**
 * Helper to correctly split a single CSV line, respecting double-quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let currentField = ''
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        currentField += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(currentField)
      currentField = ''
    } else {
      currentField += char
    }
  }
  
  result.push(currentField) // Last field
  return result
}
