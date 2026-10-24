/**
 * Phone photos are often 3–8 MB. Before uploading we shrink them on the phone to a small WebP
 * (or JPEG where the browser can't make WebP) – faster on mobile data and lighter for the server.
 */
const MAX_SIDE = 1000 // px – plenty for a menu card or an ID card check

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('This file is not a photo'))
    img.src = url
  })
}

export async function shrinkPhoto(file, maxSide = MAX_SIDE) {
  const img = await loadImage(file)
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(img.src)
  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))
  const webp = await toBlob('image/webp', 0.78)
  if (webp?.type === 'image/webp') return new File([webp], 'photo.webp', { type: 'image/webp' })
  const jpeg = await toBlob('image/jpeg', 0.8)
  return new File([jpeg], 'photo.jpg', { type: 'image/jpeg' })
}
