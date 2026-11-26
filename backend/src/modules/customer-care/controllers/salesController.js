const mongoose = require('mongoose')
const Customer = require('../../../models/Customer')
const User = require('../../../models/User')
const CustomerAccount = require('../../../models/CustomerAccount')
const CustomerProduct = require('../../../models/CustomerProduct')
const ServiceRequest = require('../../../models/ServiceRequest')
const Product = require('../../../models/Product')
const { inviteOrLink, inviteMessage } = require('../../../utils/portalInvite')
const { createCustomerRecord, detailsFromLead } = require('../customerFactory')
const { assignRequest } = require('./assignService')
const { OPEN_STATUSES, fail, checkId, text, optionalDate, listTeam, formatRequest } = require('../helpers')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function formatProduct(p) {
  return {
    id: p._id,
    productId: p.productId,
    productName: p.productName,
    serialNumber: p.serialNumber,
    purchaseDate: p.purchaseDate,
    warrantyUntil: p.warrantyUntil
  }
}

function formatCustomer(c, account) {
  return {
    id: c._id,
    customerCode: c.customerCode,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    status: c.status,
    leadId: c.leadId,
    salesExecName: c.salesExecName || '',
    portal: account ? { loginId: account.loginId, status: account.status } : null,
    createdAt: c.createdAt
  }
}

async function findMyCustomer(req, id) {
  checkId(id, 'customer')
  const customer = await Customer.findOne({ _id: id, tenantId: req.user.tenantId, salesExecId: req.user.id })
  if (!customer) throw fail('Customer not found', 404)
  return customer
}

function contactFields(body) {
  const fields = {}
  for (const [key, max] of [['name', 120], ['company', 120], ['phone', 20], ['address', 300], ['city', 80]]) {
    if (body[key] !== undefined) fields[key] = text(body[key], max)
  }
  if (body.email !== undefined) {
    const email = text(body.email, 120).toLowerCase()
    if (email && !EMAIL_PATTERN.test(email)) throw fail('Enter a valid email address')
    fields.email = email
  }
  return fields
}

async function listCustomers(req, res, next) {
  try {
    const { tenantId, id } = req.user
    const customers = await Customer.find({ tenantId, salesExecId: id }).sort({ createdAt: -1 }).limit(500).lean()
    const ids = customers.map((c) => c._id)
    const [accounts, openCounts] = await Promise.all([
      CustomerAccount.find({ tenantId, customerId: { $in: ids } }).select('customerId loginId status').lean(),
      ServiceRequest.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), customerId: { $in: ids }, status: { $in: OPEN_STATUSES } } },
        { $group: { _id: '$customerId', count: { $sum: 1 } } }
      ])
    ])
    const accountOf = Object.fromEntries(accounts.map((a) => [String(a.customerId), a]))
    const openOf = Object.fromEntries(openCounts.map((o) => [String(o._id), o.count]))

    res.json({
      count: customers.length,
      customers: customers.map((c) => ({
        ...formatCustomer(c, accountOf[String(c._id)]),
        openRequests: openOf[String(c._id)] || 0
      }))
    })
  } catch (err) {
    next(err)
  }
}

async function createCustomer(req, res, next) {
  try {
    const { tenantId, id: salesExecId } = req.user
    const salesExec = await User.findById(salesExecId).select('name').lean()
    let details = contactFields(req.body)
    let leadId = null

    if (req.body.leadId) {
      checkId(req.body.leadId, 'lead')
      const fromLead = await detailsFromLead(tenantId, req.body.leadId)
      leadId = fromLead.lead._id
      details = { ...fromLead.details, ...details }
    }

    const customer = await createCustomerRecord({ tenantId, details, leadId, salesExec })
    const invite = await inviteOrLink({ customer, issuedBy: salesExecId })

    res.status(201).json({
      message: inviteMessage(`Customer ${customer.customerCode} created.`, invite),
      customer: formatCustomer(customer, invite.portal),
      ...invite
    })
  } catch (err) {
    next(err)
  }
}

async function getCustomer(req, res, next) {
  try {
    const customer = await findMyCustomer(req, req.params.id)
    const [account, products, requests] = await Promise.all([
      CustomerAccount.findOne({ tenantId: customer.tenantId, customerId: customer._id }).lean(),
      CustomerProduct.find({ tenantId: customer.tenantId, customerId: customer._id }).sort({ createdAt: -1 }).lean(),
      ServiceRequest.find({ tenantId: customer.tenantId, customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean()
    ])
    res.json({
      customer: formatCustomer(customer, account),
      products: products.map(formatProduct),
      serviceRequests: requests.map((r) => formatRequest(r))
    })
  } catch (err) {
    next(err)
  }
}

async function updateCustomer(req, res, next) {
  try {
    const customer = await findMyCustomer(req, req.params.id)
    const fields = contactFields(req.body)
    if (fields.name === '') throw fail('Customer name cannot be empty')
    if (Object.keys(fields).length === 0) throw fail('Nothing to update')
    customer.set(fields)
    await customer.save()
    res.json({ message: 'Customer updated', customer: formatCustomer(customer) })
  } catch (err) {
    next(err)
  }
}

async function addProduct(req, res, next) {
  try {
    const customer = await findMyCustomer(req, req.params.id)
    checkId(req.body.productId, 'product')

    const product = await Product.findOne({ _id: req.body.productId, tenantId: customer.tenantId, status: 'Active' })
      .select('name')
      .lean()
    if (!product) throw fail('Product not found or inactive', 404)

    const purchaseDate = optionalDate(req.body.purchaseDate, 'purchase date') || new Date()
    const months = req.body.warrantyMonths === undefined ? 12 : Number(req.body.warrantyMonths)
    if (!Number.isInteger(months) || months < 0 || months > 120) throw fail('Warranty must be 0 to 120 months')

    const warrantyUntil = new Date(purchaseDate)
    warrantyUntil.setMonth(warrantyUntil.getMonth() + months)

    const item = await CustomerProduct.create({
      tenantId: customer.tenantId,
      customerId: customer._id,
      productId: product._id,
      productName: product.name,
      serialNumber: text(req.body.serialNumber, 60),
      purchaseDate,
      warrantyUntil: months > 0 ? warrantyUntil : null,
      addedBy: req.user.id
    })

    res.status(201).json({ message: `${product.name} added to ${customer.name}`, product: formatProduct(item) })
  } catch (err) {
    next(err)
  }
}

async function removeProduct(req, res, next) {
  try {
    const customer = await findMyCustomer(req, req.params.id)
    checkId(req.params.productItemId, 'product')

    const open = await ServiceRequest.exists({
      tenantId: customer.tenantId,
      customerProductId: req.params.productItemId,
      status: { $in: OPEN_STATUSES }
    })
    if (open) throw fail('This product has an open service request')

    const removed = await CustomerProduct.findOneAndDelete({
      _id: req.params.productItemId,
      tenantId: customer.tenantId,
      customerId: customer._id
    })
    if (!removed) throw fail('Product not found', 404)
    res.json({ message: 'Product removed' })
  } catch (err) {
    next(err)
  }
}

async function newPortalLink(req, res, next) {
  try {
    const customer = await findMyCustomer(req, req.params.id)
    const invite = await inviteOrLink({ customer, issuedBy: req.user.id })
    res.json({ message: inviteMessage('New portal link created. It works for 48 hours.', invite), ...invite })
  } catch (err) {
    if (err.statusCode === 400) return next(fail(err.message, 400))
    next(err)
  }
}

async function listRequests(req, res, next) {
  try {
    const filter = { tenantId: req.user.tenantId, salesExecId: req.user.id }
    if (req.query.status && req.query.status !== 'All') filter.status = String(req.query.status)
    const requests = await ServiceRequest.find(filter)
      .populate('customerId', 'customerCode name phone city')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
    res.json({ count: requests.length, serviceRequests: requests.map((r) => formatRequest(r)) })
  } catch (err) {
    next(err)
  }
}

async function assign(req, res, next) {
  try {
    const request = await assignRequest(req, { salesExecId: req.user.id })
    res.json({ message: `Assigned to ${request.assignedToName}`, serviceRequest: request })
  } catch (err) {
    next(err)
  }
}

async function listStaff(req, res, next) {
  try {
    res.json({ staff: await listTeam(req.user.tenantId, 'OPERATIONAL_STAFF') })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  addProduct,
  removeProduct,
  newPortalLink,
  listRequests,
  assign,
  listStaff
}