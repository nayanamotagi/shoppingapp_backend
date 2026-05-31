const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/abilities');

// Test route to verify upload router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Upload route is working!' });
});

// Upload product image (Seller and Admin)
router.post('/product-image', 
  auth, 
  authorize('create', 'Product'), 
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB' });
          }
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: err.message || 'Error uploading file' });
      }
      next();
    });
  },
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      // Return the image URL
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: error.message || 'Error uploading image' });
    }
  }
);

module.exports = router;
