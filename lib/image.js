// Client-side photo downscale before upload — keeps cellular uploads quick.
// Goloka re-encodes to the final WebP sizes, so JPEG 0.85 here loses nothing.

export const MAX_UPLOAD_PX = 2000
export const JPEG_QUALITY = 0.85

// Dimensions fitting within `max` on the long side, ratio kept, never upscaled.
export function fitWithin(width, height, max) {
  const long = Math.max(width, height)
  if (long <= max) return { width, height }
  return { width: Math.round(width * max / long), height: Math.round(height * max / long) }
}

// File/Blob → JPEG File, max 2000 px long side, quality 0.85.
export function downscaleImage(file, max = MAX_UPLOAD_PX, quality = JPEG_QUALITY) {
  return decodeImage(file).then(img => new Promise((resolve, reject) => {
    const { width, height } = fitWithin(img.width || img.naturalWidth, img.height || img.naturalHeight, max)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    if (img.close) img.close()
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Could not process image'))
      const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
      resolve(new File([blob], name, { type: 'image/jpeg' }))
    }, 'image/jpeg', quality)
  }))
}

// createImageBitmap with EXIF orientation applied; <img> fallback for older Safari.
function decodeImage(file) {
  if (typeof createImageBitmap === 'function')
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => decodeViaImg(file))
  return decodeViaImg(file)
}

function decodeViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')) }
    img.src = url
  })
}
