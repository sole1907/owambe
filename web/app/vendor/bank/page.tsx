'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Bank = { name: string; code: string }

type BankAccount = {
  account_number: string
  bank_code: string
  bank_name: string
  account_name: string
  updated_at: string
}

export default function VendorBankPage() {
  const { token } = useAuth()

  const [account, setAccount] = useState<BankAccount | null>(null)
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)

  const [accountNumber, setAccountNumber] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<BankAccount | null>('/vendor-portal/bank-account', token),
      api.get<Bank[]>('/payouts/banks', token),
    ])
      .then(([acc, bankList]) => {
        setAccount(acc)
        setBanks(bankList ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  async function handleVerify() {
    if (!token || accountNumber.length !== 10 || !bankCode) return
    setVerifying(true)
    setVerifyError(null)
    setResolvedName(null)
    try {
      const res = await api.post<{ account_name: string }>(
        '/vendor-portal/bank-account/verify',
        { accountNumber, bankCode },
        token,
      )
      setResolvedName(res.account_name)
    } catch {
      setVerifyError('Could not verify account. Check the number and bank, then try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSave() {
    if (!token || !resolvedName || !bankCode) return
    const bank = banks.find((b) => b.code === bankCode)
    if (!bank) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      const saved = await api.post<BankAccount>(
        '/vendor-portal/bank-account',
        { accountNumber, bankCode, bankName: bank.name, accountName: resolvedName },
        token,
      )
      setAccount(saved)
      setSaveSuccess(true)
      setAccountNumber('')
      setBankCode('')
      setResolvedName(null)
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bank Account</h1>
        <p className="text-sm text-gray-500 mt-1">
          This is where Owambe sends your payouts when funds are released.
        </p>
      </div>

      {/* Current account */}
      {account && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-green-700 mb-1 uppercase tracking-wide">Current account</p>
          <p className="text-base font-semibold text-gray-900">{account.account_name}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {account.account_number} · {account.bank_name}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last updated {new Date(account.updated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      {!account && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <span className="font-semibold">No bank account on file.</span> Add one below to receive payouts.
        </div>
      )}

      {/* Add / update form */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900">
          {account ? 'Update bank account' : 'Add bank account'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bank</label>
            <select
              value={bankCode}
              onChange={(e) => { setBankCode(e.target.value); setResolvedName(null) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
            >
              <option value="">Select bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Account number</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '')); setResolvedName(null) }}
                placeholder="10-digit account number"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || accountNumber.length !== 10 || !bankCode}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {verifying ? 'Checking…' : 'Verify'}
              </button>
            </div>
          </div>

          {verifyError && (
            <p className="text-sm text-red-600">{verifyError}</p>
          )}

          {resolvedName && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-600 mb-0.5">Account name</p>
              <p className="text-sm font-semibold text-blue-900">{resolvedName}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !resolvedName}
            className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving…' : account ? 'Update account' : 'Save account'}
          </button>
          {saveSuccess && (
            <p className="text-sm text-green-700 font-medium">Bank account saved.</p>
          )}
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
      </div>

      {/* Info panel */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">How payouts work</p>
        <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
          <li>The commitment fee is released to you a set number of days before the event.</li>
          <li>The materials fee is released so you can source supplies ahead of the event.</li>
          <li>The balance (quality guarantee) is released after the event is confirmed delivered.</li>
          <li>Allow 1–3 business days for transfers to arrive after release.</li>
        </ul>
      </div>
    </div>
  )
}
