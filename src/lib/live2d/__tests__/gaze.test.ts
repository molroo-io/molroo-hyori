// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { attachMouseGaze, resolveGaze } from '../gaze'

describe('resolveGaze', () => {
  it('returns mouse gaze with inverted Y', () => {
    const mouse = { x: 0.7, y: 0.4 }
    const result = resolveGaze(mouse)

    expect(result).toEqual({ x: 0.7, y: -0.4 })
  })

  it('returns null when mouse is null (fall through to saccade)', () => {
    expect(resolveGaze(null)).toBeNull()
  })

})

describe('attachMouseGaze', () => {
  function createContainer(rect: { left: number; top: number; width: number; height: number }) {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {},
    })
    return el
  }

  it('calls onGaze with normalized coordinates on mousemove', () => {
    const container = createContainer({ left: 0, top: 0, width: 200, height: 100 })
    const onGaze = vi.fn()

    attachMouseGaze(container, onGaze)

    // Center of container → (0, 0)
    container.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 50 }))
    expect(onGaze).toHaveBeenCalledWith({ x: 0, y: 0 })
  })

  it('normalizes top-left corner to (-1, -1)', () => {
    const container = createContainer({ left: 0, top: 0, width: 200, height: 100 })
    const onGaze = vi.fn()

    attachMouseGaze(container, onGaze)

    container.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }))
    expect(onGaze).toHaveBeenCalledWith({ x: -1, y: -1 })
  })

  it('normalizes bottom-right corner to (1, 1)', () => {
    const container = createContainer({ left: 0, top: 0, width: 200, height: 100 })
    const onGaze = vi.fn()

    attachMouseGaze(container, onGaze)

    container.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }))
    expect(onGaze).toHaveBeenCalledWith({ x: 1, y: 1 })
  })

  it('clamps values beyond container bounds to -1..1', () => {
    const container = createContainer({ left: 100, top: 100, width: 200, height: 200 })
    const onGaze = vi.fn()

    attachMouseGaze(container, onGaze)

    // Way beyond right edge
    container.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 100 }))
    expect(onGaze).toHaveBeenCalledWith(
      expect.objectContaining({ x: 1, y: -1 }),
    )
  })

  it('calls onGaze with null on mouseleave', () => {
    const container = createContainer({ left: 0, top: 0, width: 200, height: 100 })
    const onGaze = vi.fn()

    attachMouseGaze(container, onGaze)

    container.dispatchEvent(new MouseEvent('mouseleave'))
    expect(onGaze).toHaveBeenCalledWith(null)
  })

  it('returns cleanup that removes event listeners', () => {
    const container = createContainer({ left: 0, top: 0, width: 200, height: 100 })
    const onGaze = vi.fn()

    const cleanup = attachMouseGaze(container, onGaze)
    cleanup()

    container.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 50 }))
    container.dispatchEvent(new MouseEvent('mouseleave'))
    expect(onGaze).not.toHaveBeenCalled()
  })

})
