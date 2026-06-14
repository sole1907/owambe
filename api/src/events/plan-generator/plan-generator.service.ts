import { Injectable } from '@nestjs/common'
import { CHECKLIST_TEMPLATES } from './checklist-templates'
import { BUDGET_TEMPLATES, BudgetAllocation } from './budget-templates'
import { GeneratePlanDto } from '../dto/generate-plan.dto'

function parseApproximateDate(text: string): Date | null {
  if (!text?.trim()) return null

  // "Q3 2026", "Q1 2027" etc — use middle month of the quarter
  const quarterMatch = text.match(/Q([1-4])\s+(\d{4})/i)
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1])
    const year = parseInt(quarterMatch[2])
    const monthIndex = (quarter - 1) * 3 + 1 // Q1→Feb, Q2→May, Q3→Aug, Q4→Nov
    return new Date(year, monthIndex, 15)
  }

  // "December 2026", "Jan 2027" etc — use the 15th of that month
  const monthMatch = text.match(/([A-Za-z]+)\s+(\d{4})/)
  if (monthMatch) {
    const parsed = new Date(`${monthMatch[1]} 15, ${monthMatch[2]}`)
    if (!isNaN(parsed.getTime())) return parsed
  }

  return null
}

export type GeneratedChecklist = {
  title: string
  dueDate: string | null // ISO date string, null if no event date provided
  sortOrder: number
}

export type GeneratedPlan = {
  budgetBreakdown: (BudgetAllocation & { amount: number | null })[]
  milestones: { title: string; weeksBeforeEvent: number; dueDate: string | null }[]
}

@Injectable()
export class PlanGeneratorService {
  parseApproximateDate(text: string): Date | null {
    return parseApproximateDate(text)
  }

  generate(dto: GeneratePlanDto): { checklist: GeneratedChecklist[]; plan: GeneratedPlan } {
    const eventType = dto.eventType || 'other'
    const baseTemplates = CHECKLIST_TEMPLATES[eventType] ?? CHECKLIST_TEMPLATES['other']
    const budgetTemplate = BUDGET_TEMPLATES[eventType] ?? BUDGET_TEMPLATES['other']

    const coordinatorWeeksBefore = eventType === 'wedding' ? 16 : eventType === 'corporate' ? 12 : 10
    const coordinatorTask = dto.wantsCoordinator === true
      ? { title: 'Hire event coordinator', weeksBeforeEvent: coordinatorWeeksBefore }
      : dto.wantsCoordinator === false
        ? { title: 'Designate a day-of point person from family or friends', weeksBeforeEvent: coordinatorWeeksBefore }
        : null

    const templates = coordinatorTask
      ? [...baseTemplates, coordinatorTask].sort((a, b) => b.weeksBeforeEvent - a.weeksBeforeEvent)
      : baseTemplates

    const eventDate = dto.eventDate
      ? new Date(dto.eventDate)
      : parseApproximateDate(dto.eventDateApproximate ?? '')

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const checklist: GeneratedChecklist[] = templates.map((item, index) => {
      let dueDate: string | null = null
      if (eventDate) {
        const due = new Date(eventDate)
        due.setDate(due.getDate() - item.weeksBeforeEvent * 7)
        dueDate = due < today ? todayStr : due.toISOString().split('T')[0]
      }
      return { title: item.title, dueDate, sortOrder: index }
    })

    const budgetBreakdown = budgetTemplate.map((alloc) => ({
      ...alloc,
      amount: dto.budgetEstimate ? Math.round((alloc.percentage / 100) * dto.budgetEstimate) : null,
    }))

    const milestones = templates.map((item) => {
      let dueDate: string | null = null
      if (eventDate) {
        const due = new Date(eventDate)
        due.setDate(due.getDate() - item.weeksBeforeEvent * 7)
        dueDate = due < today ? todayStr : due.toISOString().split('T')[0]
      }
      return { title: item.title, weeksBeforeEvent: item.weeksBeforeEvent, dueDate }
    })

    return { checklist, plan: { budgetBreakdown, milestones } }
  }
}
