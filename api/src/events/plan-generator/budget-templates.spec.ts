import { BUDGET_TEMPLATES } from './budget-templates'

const EVENT_TYPES = ['wedding', 'birthday', 'naming_ceremony', 'corporate', 'burial', 'other']

describe('BUDGET_TEMPLATES', () => {
  it('defines a template for every event type', () => {
    EVENT_TYPES.forEach((type) => {
      expect(BUDGET_TEMPLATES[type]).toBeDefined()
      expect(BUDGET_TEMPLATES[type].length).toBeGreaterThan(0)
    })
  })

  it.each(EVENT_TYPES)('percentages for %s sum to 100', (type) => {
    const total = BUDGET_TEMPLATES[type].reduce((sum, item) => sum + item.percentage, 0)
    expect(total).toBe(100)
  })

  it('each allocation has a non-empty category and positive percentage', () => {
    EVENT_TYPES.forEach((type) => {
      BUDGET_TEMPLATES[type].forEach((alloc) => {
        expect(alloc.category).toBeTruthy()
        expect(alloc.percentage).toBeGreaterThan(0)
      })
    })
  })
})
