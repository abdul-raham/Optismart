const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'src', 'pages')

function processDir(directory) {
  const files = fs.readdirSync(directory)
  for (const file of files) {
    const fullPath = path.join(directory, file)
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath)
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      let changed = false

      // Replace grid-cols-1 with grid-cols-2 for responsive cards
      // Only for typical card layouts like 'grid grid-cols-1 md:grid-cols-3'
      const regex = /className="([^"]*)grid-cols-1([^"]*)"/g
      
      content = content.replace(regex, (match, p1, p2) => {
        // Exclude specific single-column lists if needed, but the user requested all dashboards.
        console.log(`Replacing in ${file}: ${match}`)
        changed = true
        return `className="${p1}grid-cols-2${p2}"`
      })

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8')
        console.log(`Updated ${fullPath}`)
      }
    }
  }
}

processDir(dir)
