import { PlanGeneratorService } from './plan-generator.service'

describe('PlanGeneratorService', () => {
  let service: PlanGeneratorService

  beforeEach(() => {
    service = new PlanGeneratorService()
  })

  describe('generate()', () => {
    it('returns a checklist and plan for a wedding with all fields', () => {
      const result = service.generate({
        eventType: 'wedding',
        eventDate: '2025-12-01',
        budgetEstimate: 2_000_000,
        eventTitle: 'Test Wedding',
      } as any)

      expect(result.checklist.length).toBeGreaterThan(0)
      expect(result.plan.budgetBreakdown.length).toBeGreaterThan(0)
      expect(result.plan.milestones.length).toBeGreaterThan(0)
    })

    it('calculates due dates relative to the event date', () => {
      const result = service.generate({
        eventType: 'birthday',
        eventDate: '2025-06-01',
        eventTitle: 'Birthday Bash',
      } as any)

      result.checklist.forEach((item) => {
        expect(item.dueDate).not.toBeNull()
        expect(new Date(item.dueDate!).getTime()).toBeLessThan(new Date('2025-06-01').getTime())
      })
    })

    it('sets dueDate to null when no eventDate is provided', () => {
      const result = service.generate({
        eventType: 'corporate',
        eventTitle: 'Company Event',
      } as any)

      result.checklist.forEach((item) => {
        expect(item.dueDate).toBeNull()
      })
    })

    it('calculates budget amounts when budgetEstimate is provided', () => {
      const budget = 1_000_000
      const result = service.generate({
        eventType: 'birthday',
        budgetEstimate: budget,
        eventTitle: 'Party',
      } as any)

      const total = result.plan.budgetBreakdown.reduce((sum, item) => sum + (item.amount ?? 0), 0)
      expect(total).toBe(budget)
    })

    it('sets amounts to null when no budget is provided', () => {
      const result = service.generate({
        eventType: 'burial',
        eventTitle: 'Memorial',
      } as any)

      result.plan.budgetBreakdown.forEach((item) => {
        expect(item.amount).toBeNull()
      })
    })

    it('falls back to "other" template for unknown event type', () => {
      const knownOther = service.generate({ eventType: 'other', eventTitle: 'x' } as any)
      const unknown = service.generate({ eventType: 'unknown_type', eventTitle: 'x' } as any)

      expect(unknown.checklist.length).toBe(knownOther.checklist.length)
    })

    it('assigns incrementing sortOrder values', () => {
      const result = service.generate({ eventType: 'wedding', eventTitle: 'x' } as any)
      result.checklist.forEach((item, idx) => {
        expect(item.sortOrder).toBe(idx)
      })
    })

    it.each(['wedding', 'birthday', 'naming_ceremony', 'corporate', 'burial', 'other'])(
      'handles event type: %s',
      (type) => {
        expect(() => service.generate({ eventType: type, eventTitle: 'Test' } as any)).not.toThrow()
      },
    )
  })
})
