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
  
  const rows = parseCSVRows(csvData)
  if (rows.length < 2) return []

  const result: PasswordEntry[] = []
  
  // Parse header
  const headers = rows[0].map(normalizeHeader)
  
  // Detect column mapping
  const titleIdx = findHeaderIndex(headers, ['title', 'name'])
  const usernameIdx = findHeaderIndex(headers, ['username', 'user', 'login', 'email', 'account', 'account name'])
  const passwordIdx = headers.findIndex(h => h === 'password')
  const urlIdx = findHeaderIndex(headers, ['url', 'website', 'site', 'web site', 'websites'])
  const notesIdx = findHeaderIndex(headers, ['notes', 'note', 'comments'])
  
  if (passwordIdx === -1) {
    throw new Error('CSV file format not recognized. No Password column found.')
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every(cell => !cell.trim())) continue
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

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    if (row.some(value => value.trim())) rows.push(row)
  }

  return rows
}

function normalizeHeader(value: string): string {
  let normalized = value.replace(/^\uFEFF/, '').trim().toLowerCase()
  normalized = normalized.replace(/[_-]+/g, ' ')
  return normalized.replace(/\s+/g, ' ')
}

function findHeaderIndex(headers: string[], names: string[]): number {
  const normalizedNames = names.map(normalizeHeader)
  return headers.findIndex(header => normalizedNames.includes(header))
}
