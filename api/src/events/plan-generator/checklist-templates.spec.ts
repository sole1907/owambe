import { CHECKLIST_TEMPLATES } from './checklist-templates'

const EVENT_TYPES = ['wedding', 'birthday', 'naming_ceremony', 'corporate', 'burial', 'other']

describe('CHECKLIST_TEMPLATES', () => {
  it('defines a template for every event type', () => {
    EVENT_TYPES.forEach((type) => {
      expect(CHECKLIST_TEMPLATES[type]).toBeDefined()
      expect(CHECKLIST_TEMPLATES[type].length).toBeGreaterThan(0)
    })
  })

  it('each item has a non-empty title and a non-negative weeksBeforeEvent', () => {
    EVENT_TYPES.forEach((type) => {
      CHECKLIST_TEMPLATES[type].forEach((item) => {
        expect(item.title).toBeTruthy()
        expect(item.weeksBeforeEvent).toBeGreaterThanOrEqual(0)
      })
    })
  })

  it('wedding template has the most items (most complex event)', () => {
    const weddingCount = CHECKLIST_TEMPLATES['wedding'].length
    const otherCounts = EVENT_TYPES.filter((t) => t !== 'wedding').map(
      (t) => CHECKLIST_TEMPLATES[t].length,
    )
    expect(weddingCount).toBeGreaterThanOrEqual(Math.max(...otherCounts))
  })

  it('items are ordered from furthest to closest to event date', () => {
    EVENT_TYPES.forEach((type) => {
      const items = CHECKLIST_TEMPLATES[type]
      for (let i = 1; i < items.length; i++) {
        expect(items[i].weeksBeforeEvent).toBeLessThanOrEqual(items[i - 1].weeksBeforeEvent)
      }
    })
  })
})
