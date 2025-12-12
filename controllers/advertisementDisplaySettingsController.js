// controllers/advertisementDisplaySettingsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get advertisement display settings (returns single settings object)
exports.getAdvertisementDisplaySettings = async (req, res) => {
  try {
    // Get the first (and should be only) settings document
    let settings = await prisma.advertisementDisplaySettings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.advertisementDisplaySettings.create({
        data: {
          enabledForNews: false,
          enabledForBlog: false,
          newsAdFrequency: 10,
          blogAdFrequency: 10,
          useFeaturedAds: true,
          adRotation: 'sequential'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Advertisement display settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching advertisement display settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisement display settings',
      error: error.message
    });
  }
};

// Public endpoint to fetch advertisement display settings
exports.getPublicAdvertisementDisplaySettings = async (req, res) => {
  try {
    const settings = await exports.getAdvertisementDisplaySettingsHelper();

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Advertisement display settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching advertisement display settings (public):', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisement display settings',
      error: error.message
    });
  }
};

// Update advertisement display settings
exports.updateAdvertisementDisplaySettings = async (req, res) => {
  try {
    const {
      enabledForNews,
      enabledForBlog,
      newsAdFrequency,
      blogAdFrequency,
      useFeaturedAds,
      adRotation
    } = req.body;

    // Validate frequency values
    if (newsAdFrequency !== undefined && (newsAdFrequency < 1 || newsAdFrequency > 100)) {
      return res.status(400).json({
        success: false,
        message: 'News ad frequency must be between 1 and 100'
      });
    }

    if (blogAdFrequency !== undefined && (blogAdFrequency < 1 || blogAdFrequency > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Blog ad frequency must be between 1 and 100'
      });
    }

    // Validate adRotation
    if (adRotation !== undefined && !['sequential', 'random'].includes(adRotation)) {
      return res.status(400).json({
        success: false,
        message: 'Ad rotation must be either "sequential" or "random"'
      });
    }

    // Get existing settings or create if doesn't exist
    let settings = await prisma.advertisementDisplaySettings.findFirst();

    if (!settings) {
      // Create new settings with provided values or defaults
      settings = await prisma.advertisementDisplaySettings.create({
        data: {
          enabledForNews: enabledForNews !== undefined ? Boolean(enabledForNews) : false,
          enabledForBlog: enabledForBlog !== undefined ? Boolean(enabledForBlog) : false,
          newsAdFrequency: newsAdFrequency !== undefined ? parseInt(newsAdFrequency) : 10,
          blogAdFrequency: blogAdFrequency !== undefined ? parseInt(blogAdFrequency) : 10,
          useFeaturedAds: useFeaturedAds !== undefined ? Boolean(useFeaturedAds) : true,
          adRotation: adRotation || 'sequential'
        }
      });
    } else {
      // Update existing settings
      settings = await prisma.advertisementDisplaySettings.update({
        where: { id: settings.id },
        data: {
          ...(enabledForNews !== undefined && { enabledForNews: Boolean(enabledForNews) }),
          ...(enabledForBlog !== undefined && { enabledForBlog: Boolean(enabledForBlog) }),
          ...(newsAdFrequency !== undefined && { newsAdFrequency: parseInt(newsAdFrequency) }),
          ...(blogAdFrequency !== undefined && { blogAdFrequency: parseInt(blogAdFrequency) }),
          ...(useFeaturedAds !== undefined && { useFeaturedAds: Boolean(useFeaturedAds) }),
          ...(adRotation !== undefined && { adRotation })
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Advertisement display settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating advertisement display settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating advertisement display settings',
      error: error.message
    });
  }
};

// Helper function to get advertisement display settings (for use in other controllers)
exports.getAdvertisementDisplaySettingsHelper = async () => {
  try {
    let settings = await prisma.advertisementDisplaySettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.advertisementDisplaySettings.create({
        data: {
          enabledForNews: false,
          enabledForBlog: false,
          newsAdFrequency: 10,
          blogAdFrequency: 10,
          useFeaturedAds: true,
          adRotation: 'sequential'
        }
      });
    }
    
    return settings;
  } catch (error) {
    console.error('Error fetching advertisement display settings:', error);
    // Return default settings on error
    return {
      enabledForNews: false,
      enabledForBlog: false,
      newsAdFrequency: 10,
      blogAdFrequency: 10,
      useFeaturedAds: true,
      adRotation: 'sequential'
    };
  }
};

// Helper function to calculate ad positions based on content count and frequency
exports.calculateAdPositions = (contentCount, frequency) => {
  if (contentCount === 0 || frequency <= 0) {
    return [];
  }

  const positions = [];
  let currentPosition = frequency;

  while (currentPosition <= contentCount) {
    positions.push(currentPosition - 1); // 0-indexed
    currentPosition += frequency;
  }

  return positions;
};

// Helper function to get advertisements for insertion
exports.getAdvertisementsForInsertion = async (settings, count) => {
  try {
    const whereClause = {
      isActive: true,
      ...(settings.useFeaturedAds && { isFeatured: true })
    };

    const ads = await prisma.advertisement.findMany({
      where: whereClause,
      orderBy: settings.adRotation === 'random' 
        ? { createdAt: 'desc' } // We'll randomize in code if needed
        : { createdAt: 'desc' },
      take: count * 2 // Get more than needed for rotation
    });

    // If random rotation, shuffle the array
    if (settings.adRotation === 'random' && ads.length > 0) {
      for (let i = ads.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ads[i], ads[j]] = [ads[j], ads[i]];
      }
    }

    return ads;
  } catch (error) {
    console.error('Error fetching advertisements for insertion:', error);
    return [];
  }
};



