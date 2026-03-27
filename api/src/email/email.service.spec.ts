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
})
