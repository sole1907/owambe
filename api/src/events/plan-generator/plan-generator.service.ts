import { Injectable } from '@nestjs/common'
import { CHECKLIST_TEMPLATES } from './checklist-templates'
import { BUDGET_TEMPLATES, BudgetAllocation } from './budget-templates'
import { GeneratePlanDto } from '../dto/generate-plan.dto'

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
  generate(dto: GeneratePlanDto): { checklist: GeneratedChecklist[]; plan: GeneratedPlan } {
    const eventType = dto.eventType || 'other'
    const templates = CHECKLIST_TEMPLATES[eventType] ?? CHECKLIST_TEMPLATES['other']
    const budgetTemplate = BUDGET_TEMPLATES[eventType] ?? BUDGET_TEMPLATES['other']

    const eventDate = dto.eventDate ? new Date(dto.eventDate) : null

    const checklist: GeneratedChecklist[] = templates.map((item, index) => {
      let dueDate: string | null = null
      if (eventDate) {
        const due = new Date(eventDate)
        due.setDate(due.getDate() - item.weeksBeforeEvent * 7)
        // Only include if due date is in the future
        dueDate = due.toISOString().split('T')[0]
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
        dueDate = due.toISOString().split('T')[0]
      }
      return { title: item.title, weeksBeforeEvent: item.weeksBeforeEvent, dueDate }
    })

    return { checklist, plan: { budgetBreakdown, milestones } }
  }
}
