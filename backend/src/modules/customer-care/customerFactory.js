const Customer = require('../../models/Customer')
const Lead = require('../../models/Lead')
const nextSequence = require('../../utils/nextSequence')
const { fail } = require('./helpers')

function duplicateError(err) {
  const keys = Object.keys(err.keyPattern || {})
  console.error('Customer duplicate key:', JSON.stringify(err.keyValue || {}))
  if (keys.includes('leadId')) return fail('This lead is already a customer. Refresh and try again.', 409)
  if (keys.includes('email')) return fail('A customer with this email already exists', 409)
  return fail(`Duplicate customer field: ${keys.join(', ') || 'unknown'}. Check the terminal for details.`, 409)
}

async function createCustomerRecord({ tenantId, details, leadId = null, salesExec }) {
  if (!details.name) throw fail('Customer name is required')

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const seq = await nextSequence(`customer:${tenantId}`)
    const customer = new Customer({
      tenantId,
      customerCode: `CUST-${String(seq).padStart(4, '0')}`,
      ...details,
      registrationDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      leadId,
      salesExecId: salesExec?._id || null,
      salesExecName: salesExec?.name || ''
    })
    customer.userId = String(customer._id)

    try {
      await customer.save()
      if (leadId) await Lead.updateOne({ _id: leadId, tenantId }, { $set: { status: 'Won' } })
      return customer
    } catch (err) {
      if (err.code !== 11000) throw err
      if (!Object.keys(err.keyPattern || {}).includes('customerCode')) throw duplicateError(err)
    }
  }
  throw fail('Could not create a customer number. Try again.', 409)
}

async function detailsFromLead(tenantId, leadId) {
  const lead = await Lead.findOne({ _id: leadId, tenantId }).lean()
  if (!lead) throw fail('Lead not found', 404)

  const existing = await Customer.findOne({ tenantId, leadId: lead._id }).select('customerCode').lean()
  if (existing) throw fail(`This lead is already customer ${existing.customerCode}`, 409)

  return {
    lead,
    details: {
      name: lead.name,
      company: lead.company || '',
      email: (lead.email || '').toLowerCase().trim(),
      phone: lead.phone || ''
    }
  }
}

module.exports = { createCustomerRecord, detailsFromLead }