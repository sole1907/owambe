import { InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PayoutsService } from './payouts.service'
import { makeSupabaseMock, q, QueryResult } from '../test/supabase.mock'
import { EmailService } from '../email/email.service'

// q() sets up single() from result but maybeSingle() is hardcoded to null.
// qm() fixes maybeSingle to also return the supplied result.
function qm<T = any>(result: QueryResult<T> = { data: null, error: null }) {
  const builder = q(result)
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  return builder
}

const mockEmail = {
  sendPaymentReleased: jest.fn().mockResolvedValue(undefined),
}

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'paystackSecretKey') return 'sk_test_secret'
    return undefined
  }),
}

const vendorRow = {
  id: 'ven-1',
  name: 'Royal Feast',
  email: 'vendor@test.com',
  is_test_vendor: true,
}
const bankAccountRow = {
  id: 'ba-1',
  account_number: '0000000001',
  bank_code: '044',
  bank_name: 'Access Bank',
  account_name: 'Royal Feast Catering',
  paystack_recipient_code: null,
  updated_at: new Date().toISOString(),
}
const scheduleItemRow = {
  id: 'sched-1',
  bucket: 'commitment',
  amount_kobo: 150000,
  interest_id: 'int-1',
  paystack_transfer_code: 'TRF_abc123',
  vendor_interests: {
    vendor_id: 'ven-1',
    vendors: vendorRow,
    events: { title: 'Wedding' },
  },
}

function makeService(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  const service = new PayoutsService(
    supabase as any,
    mockEmail as any as EmailService,
    mockConfig as any as ConfigService,
  )
  return { service, supabase }
}

global.fetch = jest.fn()

function mockFetch(response: object) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    json: jest.fn().mockResolvedValue(response),
  })
}

beforeEach(() => jest.clearAllMocks())

// ── getEarnings ───────────────────────────────────────────────────────────────

describe('getEarnings()', () => {
  it('returns empty array when vendor has no schedule items', async () => {
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      interest_payment_schedule: q({ data: [], error: null }),
    })
    const result = await service.getEarnings('user-1')
    expect(result).toEqual([])
  })

  it('returns schedule items for vendor', async () => {
    const scheduleRows = [
      {
        id: 's1',
        bucket: 'commitment',
        amount_kobo: 150000,
        scheduled_at: '2099-06-01',
        status: 'scheduled',
        vendor_interests: {
          vendor_id: 'ven-1',
          events: { title: 'Wedding', event_date: '2099-12-01' },
        },
      },
    ]
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      interest_payment_schedule: q({ data: scheduleRows, error: null }),
    })
    const result = await service.getEarnings('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].bucket).toBe('commitment')
  })
})

// ── getBankAccount ────────────────────────────────────────────────────────────

describe('getBankAccount()', () => {
  it('returns null when vendor has no bank account', async () => {
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      vendor_bank_accounts: qm({ data: null }),
    })
    const result = await service.getBankAccount('user-1')
    expect(result).toBeNull()
  })

  it('returns bank account data when found', async () => {
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      vendor_bank_accounts: qm({ data: bankAccountRow }),
    })
    const result = await service.getBankAccount('user-1')
    expect(result).toMatchObject({ account_number: '0000000001', bank_code: '044' })
  })

  it('throws when vendor not found for user', async () => {
    const { service } = makeService({
      vendors: q({ data: null, error: { message: 'not found' } }),
    })
    await expect(service.getBankAccount('user-1')).rejects.toThrow(InternalServerErrorException)
  })
})

// ── verifyBankAccount ─────────────────────────────────────────────────────────

describe('verifyBankAccount()', () => {
  it('calls Paystack resolve and returns account name', async () => {
    mockFetch({
      status: true,
      data: { account_name: 'Royal Feast Catering', account_number: '0000000001' },
    })
    const { service } = makeService()
    const result = await service.verifyBankAccount('0000000001', '044')
    expect(result).toMatchObject({ account_name: 'Royal Feast Catering' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/bank/resolve'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk_test_secret' }),
      }),
    )
  })

  it('throws when Paystack returns status false', async () => {
    mockFetch({ status: false, message: 'Account not found', data: null })
    const { service } = makeService()
    await expect(service.verifyBankAccount('0000000000', '044')).rejects.toThrow(
      InternalServerErrorException,
    )
  })
})

// ── getBanks ──────────────────────────────────────────────────────────────────

describe('getBanks()', () => {
  it('returns list of banks from Paystack', async () => {
    const banks = [{ name: 'Access Bank', code: '044', slug: 'access-bank' }]
    mockFetch({ status: true, data: banks })
    const { service } = makeService()
    const result = await service.getBanks()
    expect(result).toEqual(banks)
  })
})

// ── saveBankAccount ───────────────────────────────────────────────────────────

describe('saveBankAccount()', () => {
  it('upserts bank account and returns saved row', async () => {
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      vendor_bank_accounts: q({ data: bankAccountRow }),
    })
    const result = await service.saveBankAccount('user-1', {
      accountNumber: '0000000001',
      bankCode: '044',
      bankName: 'Access Bank',
      accountName: 'Royal Feast Catering',
    })
    expect(result).toMatchObject({ account_number: '0000000001' })
  })

  it('throws when upsert fails', async () => {
    const { service } = makeService({
      vendors: q({ data: { id: 'ven-1' } }),
      vendor_bank_accounts: q({ data: null, error: { message: 'db error' } }),
    })
    await expect(
      service.saveBankAccount('user-1', {
        accountNumber: '0000000001',
        bankCode: '044',
        bankName: 'Access Bank',
        accountName: 'Royal Feast Catering',
      }),
    ).rejects.toThrow(InternalServerErrorException)
  })
})

// ── processDueReleases ────────────────────────────────────────────────────────

describe('processDueReleases()', () => {
  it('skips when PAYSTACK_SECRET_KEY is not set', async () => {
    const noKeyConfig = { get: jest.fn().mockReturnValue(undefined) }
    const supabase = makeSupabaseMock()
    const service = new PayoutsService(
      supabase as any,
      mockEmail as any as EmailService,
      noKeyConfig as any as ConfigService,
    )
    await service.processDueReleases()
    expect(supabase._mockFrom).not.toHaveBeenCalled()
  })

  it('does nothing when no items are due', async () => {
    const { service } = makeService({
      interest_payment_schedule: q({ data: [] }),
    })
    await service.processDueReleases()
    expect(mockEmail.sendPaymentReleased).not.toHaveBeenCalled()
  })

  it('logs error when DB query fails', async () => {
    const { service } = makeService({
      interest_payment_schedule: q({ data: null, error: { message: 'db error' } }),
    })
    const logSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()
    await service.processDueReleases()
    expect(logSpy).toHaveBeenCalledWith('Failed to query due releases', expect.anything())
  })
})

// ── processScheduleItem ───────────────────────────────────────────────────────

describe('processScheduleItem()', () => {
  const baseItem = {
    id: 'sched-1',
    bucket: 'commitment',
    amount_kobo: 150000,
    interest_id: 'int-1',
    vendor_interests: {
      vendor_id: 'ven-1',
      vendors: vendorRow,
      events: { title: 'Wedding' },
    },
  }

  it('resets to scheduled and warns when vendor has no bank account', async () => {
    const { service } = makeService({
      vendor_bank_accounts: qm({ data: null }),
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()
    await service.processScheduleItem(baseItem)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no bank account'))
  })

  it('creates recipient on Paystack when none exists, then initiates transfer', async () => {
    const { service } = makeService({
      vendor_bank_accounts: qm({ data: { ...bankAccountRow, paystack_recipient_code: null } }),
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    mockFetch({ status: true, data: { recipient_code: 'RCP_new' } })
    mockFetch({ status: true, data: { transfer_code: 'TRF_new', status: 'pending' } })

    await service.processScheduleItem(baseItem)

    const calls = (global.fetch as jest.Mock).mock.calls
    expect(calls[0][0]).toContain('/transferrecipient')
    expect(calls[1][0]).toContain('/transfer')
  })

  it('reuses existing recipient code without calling /transferrecipient', async () => {
    const { service } = makeService({
      vendor_bank_accounts: qm({
        data: { ...bankAccountRow, paystack_recipient_code: 'RCP_existing' },
      }),
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    mockFetch({ status: true, data: { transfer_code: 'TRF_xyz', status: 'pending' } })

    await service.processScheduleItem(baseItem)

    const calls = (global.fetch as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toContain('/transfer')
  })

  it('marks released and sends email when Paystack returns status success', async () => {
    const { service } = makeService({
      vendor_bank_accounts: qm({
        data: { ...bankAccountRow, paystack_recipient_code: 'RCP_existing' },
      }),
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    mockFetch({ status: true, data: { transfer_code: 'TRF_xyz', status: 'success' } })

    await service.processScheduleItem(baseItem)

    expect(mockEmail.sendPaymentReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        to: vendorRow.email,
        bucket: 'commitment',
        amountNaira: 1500,
        eventTitle: 'Wedding',
      }),
    )
  })

  it('uses correct bucket label for materials bucket', async () => {
    const materialsItem = { ...baseItem, bucket: 'materials', amount_kobo: 100000 }
    const { service } = makeService({
      vendor_bank_accounts: qm({
        data: { ...bankAccountRow, paystack_recipient_code: 'RCP_existing' },
      }),
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    mockFetch({ status: true, data: { transfer_code: 'TRF_mat', status: 'success' } })

    await service.processScheduleItem(materialsItem)

    expect(mockEmail.sendPaymentReleased).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'materials', amountNaira: 1000 }),
    )
  })
})

// ── handleTransferWebhook ─────────────────────────────────────────────────────

describe('handleTransferWebhook()', () => {
  it('marks released and sends email on transfer.success', async () => {
    const { service } = makeService({
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    await service.handleTransferWebhook('transfer.success', {
      transfer_code: 'TRF_abc123',
      status: 'success',
    })
    expect(mockEmail.sendPaymentReleased).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'commitment', amountNaira: 1500 }),
    )
  })

  it('resets to scheduled on transfer.failed', async () => {
    const { service } = makeService({
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()
    await service.handleTransferWebhook('transfer.failed', {
      transfer_code: 'TRF_abc123',
      status: 'failed',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('transfer.failed'))
  })

  it('resets to scheduled on transfer.reversed', async () => {
    const { service } = makeService({
      interest_payment_schedule: qm({ data: scheduleItemRow }),
    })
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()
    await service.handleTransferWebhook('transfer.reversed', {
      transfer_code: 'TRF_abc123',
      status: 'reversed',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('transfer.reversed'))
  })

  it('warns and does not send email when no matching schedule item', async () => {
    const { service } = makeService({
      interest_payment_schedule: qm({ data: null }),
    })
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation()
    await service.handleTransferWebhook('transfer.success', {
      transfer_code: 'TRF_unknown',
      status: 'success',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TRF_unknown'))
    expect(mockEmail.sendPaymentReleased).not.toHaveBeenCalled()
  })
})
