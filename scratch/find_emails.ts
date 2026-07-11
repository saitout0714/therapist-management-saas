import glob from 'glob'
import fs from 'fs'
import path from 'path'

// Let's find all typescript/javascript files in app directory
function searchFiles(dir: string, pattern: string) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      searchFiles(fullPath, pattern)
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (content.includes(pattern)) {
        console.log(`Found pattern in: ${fullPath}`)
      }
    }
  }
}

console.log('Searching for "nodemailer"...')
searchFiles(path.join(__dirname, '../app'), 'nodemailer')
console.log('Searching for "sendMail"...')
searchFiles(path.join(__dirname, '../app'), 'sendMail')
