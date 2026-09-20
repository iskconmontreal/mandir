import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fitWithin, downscaleImage, MAX_UPLOAD_PX, JPEG_QUALITY } from '../../lib/image.js'

// ── fitWithin ──────────────────────────────────────────────────────────────

describe('fitWithin', () => {
  it('scales a landscape image down to max on the long side', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 })
  })

  it('scales a portrait image down to max on the long side', () => {
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 })
  })

  it('never upscales a small image', () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 })
  })

  it('keeps an image exactly at max untouched', () => {
    expect(fitWithin(2000, 1000, 2000)).toEqual({ width: 2000, height: 1000 })
  })

  it('rounds to whole pixels', () => {
    const { width, height } = fitWithin(3011, 2007, 2000)
    expect(Number.isInteger(width)).toBe(true)
    expect(Number.isInteger(height)).toBe(true)
    expect(Math.max(width, height)).toBe(2000)
  })
})

// ── downscaleImage ─────────────────────────────────────────────────────────
// Node has no canvas: stub createImageBitmap + document.createElement('canvas')
// and assert the wiring — target dimensions, JPEG type/quality, output name.

describe('downscaleImage', () => {
  let canvas, savedDocument, savedCIB, toBlobArgs

  beforeEach(() => {
    toBlobArgs = null
    canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob(cb, type, quality) {
        toBlobArgs = { type, quality }
        cb(new Blob(['jpeg-bytes'], { type }))
      },
    }
    savedDocument = globalThis.document
    savedCIB = globalThis.createImageBitmap
    globalThis.document = { createElement: () => canvas }
  })

  afterEach(() => {
    globalThis.document = savedDocument
    globalThis.createImageBitmap = savedCIB
  })

  it('downscales a 4000×3000 photo to ≤ 2000 px JPEG at quality 0.85', async () => {
    globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() {} })
    const out = await downscaleImage(new File(['x'], 'IMG_0042.HEIC', { type: 'image/jpeg' }))
    expect(canvas.width).toBe(2000)
    expect(canvas.height).toBe(1500)
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(MAX_UPLOAD_PX)
    expect(toBlobArgs.type).toBe('image/jpeg')
    expect(toBlobArgs.quality).toBe(JPEG_QUALITY)
    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('IMG_0042.jpg')
  })

  it('keeps a small image at its original size', async () => {
    globalThis.createImageBitmap = async () => ({ width: 1024, height: 768, close() {} })
    const out = await downscaleImage(new File(['x'], 'small.png', { type: 'image/png' }))
    expect(canvas.width).toBe(1024)
    expect(canvas.height).toBe(768)
    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('small.jpg')
  })

  it('respects a custom max size', async () => {
    globalThis.createImageBitmap = async () => ({ width: 4000, height: 2000, close() {} })
    await downscaleImage(new File(['x'], 'wide.jpg', { type: 'image/jpeg' }), 1000)
    expect(canvas.width).toBe(1000)
    expect(canvas.height).toBe(500)
  })

  it('rejects when the canvas cannot produce a blob', async () => {
    globalThis.createImageBitmap = async () => ({ width: 100, height: 100, close() {} })
    canvas.toBlob = cb => cb(null)
    await expect(downscaleImage(new File(['x'], 'bad.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Could not process image')
  })
})
