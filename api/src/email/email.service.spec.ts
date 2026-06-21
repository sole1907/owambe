import { EmailService } from './email.service'
import { ConfigService } from '@nestjs/config'

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'email-id' }),
    },
  })),
}))

const { Resend } = require('resend')

function makeService() {
  const config = { get: jest.fn().mockReturnValue('re_test_key') } as any as ConfigService
  return new EmailService(config)
}

function getSendCall(svc: EmailService): jest.Mock {
  return Resend.mock.results[0].value.emails.send as jest.Mock
}

describe('EmailService', () => {
  let svc: EmailService

  beforeEach(() => {
    Resend.mockClear()
    svc = makeService()
  })

  describe('sendInvite()', () => {
    const params = {
      to: 'guest@example.com',
      guestName: 'Adaeze',
      eventTitle: 'Birthday Party',
      eventDate: '1 June 2025',
      eventCity: 'Lagos',
      allocation: 2,
      inviteUrl: 'https://app.owambe.com/invite/abc',
      qrCodeUrl: 'https://storage.example.com/qr.png',
    }

    it('calls resend.emails.send with correct recipient and subject', async () => {
      await svc.sendInvite(params)
      const send = getSendCall(svc)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@example.com',
          subject: expect.stringContaining('Birthday Party'),
        }),
      )
    })

    it('includes guest name and event title in the HTML', async () => {
      await svc.sendInvite(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Adaeze')
      expect(html).toContain('Birthday Party')
    })

    it('includes QR code image and invite URL in the HTML', async () => {
      await svc.sendInvite(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('https://storage.example.com/qr.png')
      expect(html).toContain('https://app.owambe.com/invite/abc')
    })

    it('shows allocation and plus-one info for allocation > 1', async () => {
      await svc.sendInvite({ ...params, allocation: 3 })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('3 spot')
    })

    it('uses "Date TBC" when eventDate is empty', async () => {
      await svc.sendInvite({ ...params, eventDate: '' })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Date TBC')
    })

    it('does not throw when resend fails', async () => {
      getSendCall(svc).mockRejectedValueOnce(new Error('Network error'))
      await expect(svc.sendInvite(params)).resolves.not.toThrow()
    })
  })

  describe('sendPlusOneRequestToHost()', () => {
    const params = {
      to: 'host@example.com',
      hostName: 'Emeka',
      guestName: 'Ngozi',
      eventTitle: 'Wedding',
      requestedCount: 2,
      approveUrl: 'https://app.owambe.com/dashboard',
    }

    it('sends to host with correct subject', async () => {
      await svc.sendPlusOneRequestToHost(params)
      const send = getSendCall(svc)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'host@example.com',
          subject: expect.stringContaining('Ngozi'),
        }),
      )
    })

    it('includes guest name and requested count in the HTML', async () => {
      await svc.sendPlusOneRequestToHost(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Ngozi')
      expect(html).toContain('+2 extra spot')
    })

    it('includes the approve link', async () => {
      await svc.sendPlusOneRequestToHost(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('https://app.owambe.com/dashboard')
    })

    it('does not throw when resend fails', async () => {
      getSendCall(svc).mockRejectedValueOnce(new Error('fail'))
      await expect(svc.sendPlusOneRequestToHost(params)).resolves.not.toThrow()
    })
  })

  describe('sendPlusOneOutcomeToGuest()', () => {
    const base = {
      to: 'guest@example.com',
      guestName: 'Temi',
      eventTitle: 'Naming Ceremony',
    }

    it('sends approved outcome with new allocation', async () => {
      await svc.sendPlusOneOutcomeToGuest({ ...base, approved: true, newAllocation: 3 })
      const { html, subject } = getSendCall(svc).mock.calls[0][0]
      expect(subject).toContain('approved')
      expect(html).toContain('approved')
      expect(html).toContain('3 spot')
    })

    it('sends rejection outcome', async () => {
      await svc.sendPlusOneOutcomeToGuest({ ...base, approved: false })
      const { html, subject } = getSendCall(svc).mock.calls[0][0]
      expect(subject).toContain('Naming Ceremony')
      expect(html).toContain('not approved')
    })

    it('does not throw when resend fails', async () => {
      getSendCall(svc).mockRejectedValueOnce(new Error('fail'))
      await expect(
        svc.sendPlusOneOutcomeToGuest({ ...base, approved: true }),
      ).resolves.not.toThrow()
    })
  })

  describe('sendVendorInquiry()', () => {
    const params = {
      to: 'vendor@test.com',
      vendorName: 'Chef Amara',
      eventTitle: 'Wedding',
      eventDate: '2099-01-01',
      eventCity: 'Lagos',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      offeredPrice: '₦300,000',
    }

    it('sends inquiry email to vendor', async () => {
      await svc.sendVendorInquiry(params)
      const send = getSendCall(svc)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'vendor@test.com',
          subject: expect.stringContaining('Wedding'),
        }),
      )
    })

    it('includes offered price when provided', async () => {
      await svc.sendVendorInquiry(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('₦300,000')
    })

    it('works without offered price', async () => {
      await svc.sendVendorInquiry({ ...params, offeredPrice: null })
      expect(getSendCall(svc)).toHaveBeenCalled()
    })

    it('does not throw when resend fails', async () => {
      getSendCall(svc).mockRejectedValueOnce(new Error('fail'))
      await expect(svc.sendVendorInquiry(params)).resolves.not.toThrow()
    })
  })

  describe('sendCommitmentConfirmedToOrganiser()', () => {
    it('sends commitment confirmed email', async () => {
      await svc.sendCommitmentConfirmedToOrganiser({
        to: 'user@test.com',
        organizerName: 'Bola',
        vendorName: 'Chef Amara',
        eventTitle: 'Wedding',
        eventDate: '2099-01-01',
        amountPaid: 150000,
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Chef Amara')
    })
  })

  describe('sendCommitmentConfirmedToVendor()', () => {
    it('sends commitment confirmed email to vendor', async () => {
      await svc.sendCommitmentConfirmedToVendor({
        to: 'vendor@test.com',
        vendorName: 'Chef Amara',
        organizerName: 'Bola',
        eventTitle: 'Wedding',
        eventDate: '2099-01-01',
        amountHeld: 150000,
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Bola')
    })
  })

  describe('sendReviewReminder()', () => {
    it('sends review reminder email', async () => {
      await svc.sendReviewReminder({
        to: 'user@test.com',
        organizerName: 'Bola',
        vendorName: 'Chef Amara',
        eventTitle: 'Wedding',
        interestId: 'int-1',
        reminderNumber: 1,
        isLast: false,
      })
      const send = getSendCall(svc)
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@test.com' }))
    })

    it('includes "last reminder" context when isLast is true', async () => {
      await svc.sendReviewReminder({
        to: 'user@test.com',
        organizerName: 'Bola',
        vendorName: 'Chef Amara',
        eventTitle: 'Wedding',
        interestId: 'int-1',
        reminderNumber: 5,
        isLast: true,
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('last')
    })
  })

  describe('sendVendorCancelledToOrganiser()', () => {
    const params = {
      to: 'user@test.com',
      organizerName: 'Bola',
      vendorName: 'Chef Amara',
      eventTitle: 'Wedding',
      eventDate: '2099-01-01',
      heldRefundedNaira: 150000,
      outstandingNaira: 0,
      repaymentDeadline: null,
    }

    it('sends cancellation email with no outstanding', async () => {
      await svc.sendVendorCancelledToOrganiser(params)
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Chef Amara')
      expect(html).toContain('No additional amount outstanding')
    })

    it('shows outstanding amount when vendor owes money', async () => {
      await svc.sendVendorCancelledToOrganiser({
        ...params,
        outstandingNaira: 50000,
        repaymentDeadline: '2099-07-01T00:00:00Z',
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('outstanding')
    })

    it('shows held refund block when heldRefundedNaira > 0', async () => {
      await svc.sendVendorCancelledToOrganiser({ ...params, heldRefundedNaira: 100000 })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('returned to you immediately')
    })
  })

  describe('sendOrganiserCancelledToVendor()', () => {
    it('sends organiser cancellation email to vendor', async () => {
      await svc.sendOrganiserCancelledToVendor({
        to: 'vendor@test.com',
        vendorName: 'Chef Amara',
        organizerName: 'Bola',
        eventTitle: 'Wedding',
        eventDate: '2099-01-01',
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Bola')
    })
  })

  describe('sendRepaymentDemandToVendor()', () => {
    it('sends repayment demand email', async () => {
      await svc.sendRepaymentDemandToVendor({
        to: 'vendor@test.com',
        vendorName: 'Chef Amara',
        organizerName: 'Bola',
        eventTitle: 'Wedding',
        outstandingNaira: 50000,
        repaymentDeadline: '2099-07-01T00:00:00Z',
      })
      const { html } = getSendCall(svc).mock.calls[0][0]
      expect(html).toContain('Bola')
    })
  })

  describe('sendExtensionGrantedToOrganiser()', () => {
    it('sends extension granted email', async () => {
      await svc.sendExtensionGrantedToOrganiser({
        to: 'user@test.com',
        organizerName: 'Bola',
        vendorName: 'Chef Amara',
        eventTitle: 'Wedding',
        newDeadline: '2099-07-08T00:00:00Z',
      })
      const { html, subject } = getSendCall(svc).mock.calls[0][0]
      expect(subject).toContain('Chef Amara')
      expect(html).toContain('extension')
    })
  })

  describe('test email interception', () => {
    it('intercepts @owambe.test addresses when TEST_EMAIL_INTERCEPT is set', async () => {
      const config = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_key'
          if (key === 'testEmailIntercept') return 'admin@owambe.com'
          return undefined
        }),
      } as any as ConfigService
      const interceptSvc = new EmailService(config)
      await interceptSvc.sendVendorInquiry({
        to: 'vendor@owambe.test',
        vendorName: 'Test Vendor',
        eventTitle: 'Test Event',
        eventDate: '2099-01-01',
        eventCity: 'Lagos',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        offeredPrice: null,
      })
      // interceptSvc is the 2nd Resend instance created (svc was 1st in beforeEach)
      const send = Resend.mock.results[1].value.emails.send as jest.Mock
      const lastCall = send.mock.calls[send.mock.calls.length - 1][0]
      expect(lastCall.to).toBe('admin@owambe.com')
    })

    it('does not intercept normal email addresses', async () => {
      await svc.sendVendorInquiry({
        to: 'normal@vendor.com',
        vendorName: 'Normal Vendor',
        eventTitle: 'Test Event',
        eventDate: '2099-01-01',
        eventCity: 'Lagos',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        offeredPrice: null,
      })
      const send = getSendCall(svc)
      const lastCall = send.mock.calls[send.mock.calls.length - 1][0]
      expect(lastCall.to).toBe('normal@vendor.com')
    })
  })

  describe('when RESEND_API_KEY is not set', () => {
    it('does not throw when resend is not configured', async () => {
      const config = { get: jest.fn().mockReturnValue(undefined) } as any as ConfigService
      const unconfiguredSvc = new EmailService(config)
      await expect(
        unconfiguredSvc.sendVendorInquiry({
          to: 'vendor@test.com',
          vendorName: 'Chef',
          eventTitle: 'Wedding',
          eventDate: '2099-01-01',
          eventCity: 'Lagos',
          expiresAt: new Date().toISOString(),
          offeredPrice: null,
        }),
      ).resolves.not.toThrow()
    })
  })
})
