const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const User = require('../../models/User')

const OPEN_STATUSES = ['Requested', 'Assigned', 'In Progress']

function fail(message, status = 400) {
  return new AppError(message, status)
}

function checkId(id, label) {
  if (!mongoose.isValidObjectId(id)) throw fail(`Invalid ${label} ID`, 400)
}

function text(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw fail(`Invalid ${label}`, 400)
  return date
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

async function findTeamUser(tenantId, userId, role, label) {
  checkId(userId, label)
  const user = await User.findOne({ _id: userId, tenantId, role, status: 'Active' }).select('name email').lean()
  if (!user) throw fail(`${label} not found or inactive`, 400)
  return user
}

async function listTeam(tenantId, role) {
  const users = await User.find({ tenantId, role, status: 'Active' }).select('name email').sort({ name: 1 }).lean()
  return users.map((u) => ({ id: u._id, name: u.name, email: u.email }))
}

function addUpdate(request, status, note, req) {
  request.updates.push({
    status,
    note: text(note, 500),
    byName: req.user?.name || '',
    byRole: req.user?.role || 'CUSTOMER'
  })
}

function formatRequest(r, { forCustomer = false } = {}) {
  const base = {
    id: r._id,
    requestNumber: r.requestNumber,
    serviceType: r.serviceType,
    productName: r.productName,
    description: r.description,
    preferredDate: r.preferredDate,
    status: r.status,
    assignedToName: r.assignedToName || null,
    scheduledDate: r.scheduledDate,
    completedAt: r.completedAt,
    charge: r.charge || 0,
    paymentStatus: r.paymentStatus || 'Not Required',
    paidAt: r.paidAt || null,
    createdAt: r.createdAt,
    updates: (r.updates || []).map((u) => ({ status: u.status, note: u.note, byName: u.byName, at: u.at }))
  }
  if (forCustomer) return base
  return {
    ...base,
    customerId: r.customerId?._id || r.customerId,
    customer: r.customerId?.name
      ? {
          id: r.customerId._id,
          customerCode: r.customerId.customerCode,
          name: r.customerId.name,
          phone: r.customerId.phone,
          city: r.customerId.city
        }
      : undefined,
    address: r.address,
    salesExecId: r.salesExecId,
    assignedTo: r.assignedTo
  }
}

module.exports = {
  OPEN_STATUSES,
  fail,
  checkId,
  text,
  optionalDate,
  startOfToday,
  findTeamUser,
  listTeam,
  addUpdate,
  formatRequest
}