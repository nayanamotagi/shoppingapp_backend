const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/abilities');

const router = express.Router();

// Get all users (Admin only)
router.get('/', auth, authorize('read', 'User'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, authorize('read', 'User'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Block user (Admin only)
router.patch('/:id/block', auth, authorize('update', 'User'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.isBlocked = true;
    await user.save();
    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unblock user (Admin only)
router.patch('/:id/unblock', auth, authorize('update', 'User'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.isBlocked = false;
    await user.save();
    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, authorize('delete', 'User'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.deleteOne();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
