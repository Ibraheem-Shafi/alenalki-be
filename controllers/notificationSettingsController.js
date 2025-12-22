// controllers/notificationSettingsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get notification settings (returns single settings object)
exports.getNotificationSettings = async (req, res) => {
  try {
    // Get the first (and should be only) settings document
    let settings = await prisma.notificationSettings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {
          newsNotifications: true,
          blogNotifications: true,
          advertisementNotifications: true,
          advertisementEventNotifications: true,
          advertisementPosterNotifications: true,
          sponsorNotifications: true
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Notification settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching notification settings',
      error: error.message
    });
  }
};

// Update notification settings
exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      newsNotifications,
      blogNotifications,
      advertisementNotifications,
      advertisementEventNotifications,
      advertisementPosterNotifications,
      sponsorNotifications
    } = req.body;

    // Get existing settings or create if doesn't exist
    let settings = await prisma.notificationSettings.findFirst();

    if (!settings) {
      // Create new settings with provided values or defaults
      settings = await prisma.notificationSettings.create({
        data: {
          newsNotifications: newsNotifications !== undefined ? Boolean(newsNotifications) : true,
          blogNotifications: blogNotifications !== undefined ? Boolean(blogNotifications) : true,
          advertisementNotifications: advertisementNotifications !== undefined ? Boolean(advertisementNotifications) : true,
          advertisementEventNotifications: advertisementEventNotifications !== undefined ? Boolean(advertisementEventNotifications) : true,
          advertisementPosterNotifications: advertisementPosterNotifications !== undefined ? Boolean(advertisementPosterNotifications) : true,
          sponsorNotifications: sponsorNotifications !== undefined ? Boolean(sponsorNotifications) : true
        }
      });
    } else {
      // Update existing settings
      settings = await prisma.notificationSettings.update({
        where: { id: settings.id },
        data: {
          ...(newsNotifications !== undefined && { newsNotifications: Boolean(newsNotifications) }),
          ...(blogNotifications !== undefined && { blogNotifications: Boolean(blogNotifications) }),
          ...(advertisementNotifications !== undefined && { advertisementNotifications: Boolean(advertisementNotifications) }),
          ...(advertisementEventNotifications !== undefined && { advertisementEventNotifications: Boolean(advertisementEventNotifications) }),
          ...(advertisementPosterNotifications !== undefined && { advertisementPosterNotifications: Boolean(advertisementPosterNotifications) }),
          ...(sponsorNotifications !== undefined && { sponsorNotifications: Boolean(sponsorNotifications) })
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating notification settings',
      error: error.message
    });
  }
};

// Helper function to get notification settings (for use in other controllers)
exports.getNotificationSettingsHelper = async () => {
  try {
    let settings = await prisma.notificationSettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.notificationSettings.create({
        data: {
          newsNotifications: true,
          blogNotifications: true,
          advertisementNotifications: true,
          advertisementEventNotifications: true,
          advertisementPosterNotifications: true,
          sponsorNotifications: true
        }
      });
    }
    
    return settings;
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    // Return default settings on error
    return {
      newsNotifications: true,
      blogNotifications: true,
      advertisementNotifications: true,
      advertisementEventNotifications: true,
      advertisementPosterNotifications: true,
      sponsorNotifications: true
    };
  }
};

