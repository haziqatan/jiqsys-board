export function clipboardImageFiles(clipboardData) {
  if (!clipboardData) return []

  const itemFiles = Array.from(clipboardData.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)

  if (itemFiles.length > 0) return itemFiles

  return Array.from(clipboardData.files || [])
    .filter((file) => file.type.startsWith('image/'))
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Image file could not be read as a data URL.'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('Image file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export function handleClipboardImagePaste(event, insertImage) {
  const files = clipboardImageFiles(event.clipboardData)
  if (files.length === 0) return false

  event.preventDefault()
  event.stopPropagation()

  Promise.all(files.map(readImageAsDataUrl))
    .then((sources) => {
      sources.forEach((src) => insertImage(src))
    })
    .catch((error) => console.error(error))

  return true
}
