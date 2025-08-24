const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const contactController = require('../controllers/contactController');
const newsletterController = require('../controllers/newsletterController');
const userController = require('../controllers/userController');
const eventController = require('../controllers/eventController');
const festivalHighlightController = require('../controllers/festivalHighlightController');
const festivalEventController = require('../controllers/festivalEventController');
const transportationController = require('../controllers/transportationController');
const newsController = require('../controllers/newsController');
const blogController = require('../controllers/blogController');
const multer = require('multer');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

// Configure multer for memory storage (for Cloudinary uploads)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Auth routes - public
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword); // Changed from '/reset-password/:token'
router.get('/logout', authController.logout);

// Contact routes - public
router.post('/contact', contactController.submitContactForm);

// User management routes (protected and admin-only)
router.post('/user/', protect, restrictTo('ADMIN'), userController.createUser);                    // Create user
router.get('/user/', protect, restrictTo('ADMIN', 'EDITOR'), userController.getUsers);             // Get all users with pagination
router.get('/user/:id', protect, restrictTo('ADMIN', 'EDITOR'), userController.getUserById);       // Get user by ID
router.put('/user/:id', protect, restrictTo('ADMIN'), userController.updateUser);                  // Update user (all fields optional)
router.patch('/user/:id/password', protect, restrictTo('ADMIN'), userController.updateUserPassword); // Update user password
router.patch('/user/:id/toggle-status', protect, restrictTo('ADMIN'), userController.toggleUserStatus); // Toggle active status
router.delete('/user/:id', protect, restrictTo('ADMIN'), userController.deleteUser);               // Delete user

// Newsletter routes - mixed access
router.post('/newsletter/subscribe', newsletterController.subscribeToNewsletter);       // Public
router.post('/newsletter/unsubscribe', newsletterController.unsubscribeFromNewsletter); // Public
router.get('/newsletter/stats', protect, restrictTo('ADMIN', 'EDITOR'), newsletterController.getNewsletterStats); // Protected

// Event management routes - ADMIN only
router.post('/events', eventController.createEvent);                 // Create event
router.get('/events', eventController.getEvents);          // Get all events with pagination
router.get('/events/:id', optionalAuth, eventController.getEventById);                                   // Get event by ID - public with auth optional
router.put('/events/:id', protect, restrictTo('ADMIN'), eventController.updateEvent);              // Update event (all fields optional)
router.patch('/events/:id/toggle-status', protect, restrictTo('ADMIN'), eventController.toggleEventStatus); // Toggle active status
router.delete('/events/:id', protect, restrictTo('ADMIN'), eventController.deleteEvent);           // Delete event

// Festival Events routes - ADMIN only
router.post('/festival-events', protect, restrictTo('ADMIN'), festivalEventController.createFestivalEvent);                 // Create festival event
router.get('/festival-events', festivalEventController.getFestivalEvents);          // Get all festival events with pagination
router.get('/festival-events/public', festivalEventController.getPublicFestivalEvents);                                           // Get public festival events (active only) - public
router.get('/festival-events/:id', optionalAuth, festivalEventController.getFestivalEventById);                                   // Get festival event by ID - public with auth optional
router.put('/festival-events/:id', protect, restrictTo('ADMIN'), festivalEventController.updateFestivalEvent);              // Update festival event
router.patch('/festival-events/:id/toggle-status', protect, restrictTo('ADMIN'), festivalEventController.toggleFestivalEventStatus); // Toggle active status
router.delete('/festival-events/:id', protect, restrictTo('ADMIN'), festivalEventController.deleteFestivalEvent);           // Delete festival event

// Festival Highlights routes - ADMIN only
router.post('/festival-highlights', protect, restrictTo('ADMIN'), festivalHighlightController.createFestivalHighlight);                 // Create highlight
router.get('/festival-highlights', festivalHighlightController.getFestivalHighlights);          // Get all highlights with pagination
router.get('/festival-highlights/public', festivalHighlightController.getPublicFestivalHighlights);                                           // Get public highlights (active only) - public
router.get('/festival-highlights/:id', optionalAuth, festivalHighlightController.getFestivalHighlightById);                                   // Get highlight by ID - public with auth optional
router.put('/festival-highlights/:id', protect, restrictTo('ADMIN'), festivalHighlightController.updateFestivalHighlight);              // Update highlight
router.patch('/festival-highlights/:id/toggle-status', protect, restrictTo('ADMIN'), festivalHighlightController.toggleFestivalHighlightStatus); // Toggle active status
router.delete('/festival-highlights/:id', protect, restrictTo('ADMIN'), festivalHighlightController.deleteFestivalHighlight);           // Delete highlight

// Transportation routes - ADMIN only
router.post('/transportations', protect, restrictTo('ADMIN'), transportationController.createTransportation);                 // Create transportation option
router.get('/transportations', transportationController.getAllTransportations);       // Get all transportation options with pagination
router.get('/transportations/public', transportationController.getPublicTransportations);                                           // Get public transportation options (active only) - public
router.get('/transportations/:id', optionalAuth, transportationController.getTransportationById);                                   // Get transportation option by ID - public with auth optional
router.put('/transportations/:id', protect, restrictTo('ADMIN'), transportationController.updateTransportation);              // Update transportation option
router.patch('/transportations/:id/toggle-status', protect, restrictTo('ADMIN'), transportationController.toggleTransportationStatus); // Toggle active status
router.delete('/transportations/:id', protect, restrictTo('ADMIN'), transportationController.deleteTransportation);           // Delete transportation option

// News routes - EDITORs and ADMIN can manage
router.post('/news', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('imageFile'), newsController.createNews);                 // Create news with optional image upload
router.get('/news', newsController.getAllNews);                                              // Get all news with pagination
router.get('/news/public', newsController.getPublicNews);                                                                                  // Get public news (active only) - public
router.get('/news/trending', newsController.getTrendingNews);                                                                              // Get trending news - public
router.get('/news/:id', optionalAuth, newsController.getNewsById);                                                                         // Get news by ID - public with auth optional
router.put('/news/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('imageFile'), newsController.updateNews);              // Update news with optional image upload
router.patch('/news/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), newsController.toggleNewsStatus);                    // Toggle active status
router.patch('/news/:id/toggle-trending', protect, restrictTo('ADMIN', 'EDITOR'), newsController.toggleTrendingStatus);              // Toggle trending status
router.delete('/news/:id', protect, restrictTo('ADMIN', 'EDITOR'), newsController.deleteNews);                                       // Delete news

// Blog routes - EDITORs and ADMIN can manage
router.post('/blogs', protect, restrictTo('ADMIN', 'EDITOR'), upload.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 }]), blogController.createBlog);                 // Create blog with optional image and PDF upload
router.get('/blogs', blogController.getAllBlogs);                                           // Get all blogs with pagination
router.get('/blogs/public', blogController.getPublicBlogs);                                                                               // Get public blogs (active only) - public
router.get('/blogs/featured', blogController.getFeaturedBlogs);                                                                           // Get featured blogs - public
router.get('/blogs/:id', optionalAuth, blogController.getBlogById);                                                                       // Get blog by ID - public with auth optional
router.put('/blogs/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 }]), blogController.updateBlog);              // Update blog with optional image and PDF upload
router.patch('/blogs/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), blogController.toggleBlogStatus);                  // Toggle active status
router.patch('/blogs/:id/toggle-featured', protect, restrictTo('ADMIN', 'EDITOR'), blogController.toggleFeaturedStatus);            // Toggle featured status
router.delete('/blogs/:id', protect, restrictTo('ADMIN', 'EDITOR'), blogController.deleteBlog);                                     // Delete blog

module.exports = router;
