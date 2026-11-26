const express = require('express')
const { authLimiter } = require('../../../middleware/limiters')
const { updateProfile, changePassword } = require('../controllers/profileController')

const router = express.Router()

router.patch('/profile', updateProfile)
router.post('/change-password', authLimiter, changePassword)

module.exports = router