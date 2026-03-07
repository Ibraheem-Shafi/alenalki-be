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
const advertisementController = require('../controllers/advertisementController');
const notificationSettingsController = require('../controllers/notificationSettingsController');
const advertisementDisplaySettingsController = require('../controllers/advertisementDisplaySettingsController');
const advertisementEventController = require('../controllers/advertisementEventController');
const sponsorController = require('../controllers/sponsorController');
const commentController = require('../controllers/commentController');
const commentSettingsController = require('../controllers/commentSettingsController');
const multer = require('multer');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

// Configure multer for disk storage
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const pdfsDir = path.join(uploadsDir, 'pdfs');

[uploadsDir, imagesDir, pdfsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on file type
    if (file.fieldname === 'imageFile') {
      cb(null, imagesDir);
    } else if (file.fieldname === 'pdfFile') {
      cb(null, pdfsDir);
    } else {
      cb(null, imagesDir); // Default to images
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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
router.get('/news/list-for-moderation', protect, restrictTo('ADMIN', 'EDITOR'), newsController.getNewsListForModeration);                  // List news id+title for comment moderation dropdown
// Comment routes for news (must be before /news/:id)
router.get('/news/:id/comments', (req, res, next) => { req.params.articleType = 'news'; req.params.articleId = req.params.id; next(); }, commentController.getCommentsByArticle);
router.post('/news/:id/comments', (req, res, next) => { req.body.articleType = 'news'; req.body.articleId = req.params.id; next(); }, commentController.createComment);
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
router.get('/blogs/list-for-moderation', protect, restrictTo('ADMIN', 'EDITOR'), blogController.getBlogListForModeration);                 // List blogs id+title for comment moderation dropdown
// Comment routes for blogs (must be before /blogs/:id)
router.get('/blogs/:id/comments', (req, res, next) => { req.params.articleType = 'blog'; req.params.articleId = req.params.id; next(); }, commentController.getCommentsByArticle);
router.post('/blogs/:id/comments', (req, res, next) => { req.body.articleType = 'blog'; req.body.articleId = req.params.id; next(); }, commentController.createComment);
router.get('/blogs/:id', optionalAuth, blogController.getBlogById);                                                                       // Get blog by ID - public with auth optional
router.put('/blogs/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 }]), blogController.updateBlog);              // Update blog with optional image and PDF upload
router.patch('/blogs/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), blogController.toggleBlogStatus);                  // Toggle active status
router.patch('/blogs/:id/toggle-featured', protect, restrictTo('ADMIN', 'EDITOR'), blogController.toggleFeaturedStatus);            // Toggle featured status
router.delete('/blogs/:id', protect, restrictTo('ADMIN', 'EDITOR'), blogController.deleteBlog);                                     // Delete blog

// Comment moderation routes - EDITORs and ADMIN
router.get('/comments', protect, restrictTo('ADMIN', 'EDITOR'), commentController.getComments);
  router.patch('/comments/:id', protect, restrictTo('ADMIN', 'EDITOR'), commentController.updateCommentStatus);
  router.delete('/comments/:id', protect, restrictTo('ADMIN', 'EDITOR'), commentController.deleteComment);
  router.get('/comment-settings', commentSettingsController.getCommentSettings);
  router.put('/comment-settings', protect, restrictTo('ADMIN', 'EDITOR'), commentSettingsController.updateCommentSettings);

// Advertisement routes - EDITORs and ADMIN can manage
router.post('/advertisements', protect, restrictTo('ADMIN', 'EDITOR'), upload.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 }]), advertisementController.createAdvertisement);                 // Create advertisement with optional image and PDF upload
router.get('/advertisements', advertisementController.getAllAdvertisements);                                           // Get all advertisements with pagination
router.get('/advertisements/public', advertisementController.getPublicAdvertisements);                                                                               // Get public advertisements (active only) - public
router.get('/advertisements/featured', advertisementController.getFeaturedAdvertisements);                                                                           // Get featured advertisements - public
router.get('/advertisements/:id', optionalAuth, advertisementController.getAdvertisementById);                                                                       // Get advertisement by ID - public with auth optional
router.put('/advertisements/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 }]), advertisementController.updateAdvertisement);              // Update advertisement with optional image and PDF upload
router.patch('/advertisements/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), advertisementController.toggleAdvertisementStatus);                  // Toggle active status
router.patch('/advertisements/:id/toggle-featured', protect, restrictTo('ADMIN', 'EDITOR'), advertisementController.toggleFeaturedStatus);            // Toggle featured status
router.delete('/advertisements/:id', protect, restrictTo('ADMIN', 'EDITOR'), advertisementController.deleteAdvertisement);                                     // Delete advertisement

// Notification Settings routes - ADMIN only
router.get('/notification-settings', protect, restrictTo('ADMIN'), notificationSettingsController.getNotificationSettings);        // Get notification settings
router.put('/notification-settings', protect, restrictTo('ADMIN'), notificationSettingsController.updateNotificationSettings);  // Update notification settings

// Advertisement Display Settings routes - ADMIN only
router.get('/advertisement-display-settings', protect, restrictTo('ADMIN'), advertisementDisplaySettingsController.getAdvertisementDisplaySettings);        // Get advertisement display settings
router.put('/advertisement-display-settings', protect, restrictTo('ADMIN'), advertisementDisplaySettingsController.updateAdvertisementDisplaySettings);  // Update advertisement display settings
router.get('/advertisement-display-settings/public', advertisementDisplaySettingsController.getPublicAdvertisementDisplaySettings);  // Public access to advertisement display settings

// Advertisement Event routes
router.post('/advertisement-events', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('imageFile'), advertisementEventController.createAdvertisementEvent);
router.get('/advertisement-events', protect, restrictTo('ADMIN', 'EDITOR'), advertisementEventController.getAllAdvertisementEvents);
router.get('/advertisement-events/public', advertisementEventController.getPublicAdvertisementEvents);
router.get('/advertisement-events/featured', advertisementEventController.getFeaturedAdvertisementEvent);
router.get('/advertisement-events/upcoming', advertisementEventController.getPublicAdvertisementEvents);
router.get('/advertisement-events/calendar', advertisementEventController.getCalendarEvents);
router.get('/advertisement-events/:id', optionalAuth, advertisementEventController.getAdvertisementEventById);
router.put('/advertisement-events/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('imageFile'), advertisementEventController.updateAdvertisementEvent);
router.patch('/advertisement-events/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), advertisementEventController.toggleEventStatus);
router.patch('/advertisement-events/:id/toggle-featured', protect, restrictTo('ADMIN', 'EDITOR'), advertisementEventController.toggleFeaturedStatus);
router.delete('/advertisement-events/:id', protect, restrictTo('ADMIN', 'EDITOR'), advertisementEventController.deleteAdvertisementEvent);

// Sponsor routes
router.post('/sponsors', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('logoFile'), sponsorController.createSponsor);
router.get('/sponsors', protect, restrictTo('ADMIN', 'EDITOR'), sponsorController.getAllSponsors);
router.get('/sponsors/public', sponsorController.getPublicSponsors);
router.get('/sponsors/:id', optionalAuth, sponsorController.getSponsorById);
router.put('/sponsors/:id', protect, restrictTo('ADMIN', 'EDITOR'), upload.single('logoFile'), sponsorController.updateSponsor);
router.patch('/sponsors/:id/toggle-status', protect, restrictTo('ADMIN', 'EDITOR'), sponsorController.toggleSponsorStatus);
router.delete('/sponsors/:id', protect, restrictTo('ADMIN', 'EDITOR'), sponsorController.deleteSponsor);

module.exports = router;
