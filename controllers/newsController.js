// controllers/newsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

// Helper function to generate file URL from file path
const getFileUrl = (filePath) => {
  if (!filePath) return null;
  // Convert file path to full URL
  // Multer diskStorage provides absolute path like: G:\...\backend\uploads\images\filename.jpg
  // We need: http://localhost:5000/uploads/images/filename.jpg
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Extract relative path from uploads directory
  // Find the 'uploads' folder in the path
  const uploadsIndex = normalizedPath.indexOf('uploads/');
  if (uploadsIndex === -1) {
    // If no 'uploads/' found, try to extract from the end
    const pathParts = normalizedPath.split('/');
    const uploadsPartIndex = pathParts.findIndex(part => part === 'uploads');
    if (uploadsPartIndex !== -1) {
      const relativePath = pathParts.slice(uploadsPartIndex).join('/');
      const baseUrl = process.env.API_BASE_URL || 
                      process.env.BACKEND_URL || 
                      `http://localhost:${process.env.PORT || 5000}`;
      return `${baseUrl}/${relativePath}`;
    }
    // Fallback: assume it's already a relative path
    const baseUrl = process.env.API_BASE_URL || 
                    process.env.BACKEND_URL || 
                    `http://localhost:${process.env.PORT || 5000}`;
    return `${baseUrl}/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
  }
  
  // Extract everything from 'uploads/' onwards
  const relativePath = normalizedPath.substring(uploadsIndex);
  
  // Get base URL from environment or construct it
  const baseUrl = process.env.API_BASE_URL || 
                  process.env.BACKEND_URL || 
                  `http://localhost:${process.env.PORT || 5000}`;
  
  return `${baseUrl}/${relativePath}`;
};

// Get all news with filtering and pagination
exports.getAllNews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      active,
      category,
      trending,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Parse query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const isTrending = trending === 'true' ? true : trending === 'false' ? false : undefined;

    // Build filter object
    const filter = {
      where: {
        ...(search && typeof search === 'string' && search.trim() && {
          OR: [
            { title: { contains: search.trim(), mode: 'insensitive' } },
            { content: { contains: search.trim(), mode: 'insensitive' } },
            { category: { contains: search.trim(), mode: 'insensitive' } }
          ]
        }),
        ...(isActive !== undefined && { isActive }),
        ...(isTrending !== undefined && { isTrending }),
        ...(category && typeof category === 'string' && category.trim() && { category: { contains: category.trim(), mode: 'insensitive' } })
      },
      orderBy: {
        [sortBy]: sortOrder?.toLowerCase() || 'desc'
      }
    };

    // Count total records with filter
    const totalCount = await prisma.news.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const news = await prisma.news.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        news,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'News retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching news',
      error: error.message
    });
  }
};

// Get public news (active only)
exports.getPublicNews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      isTrending
    } = req.query;

    // Parse query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const isTrendingValue = isTrending === 'true' ? true : undefined;

    // Build filter object
    const filter = {
      where: {
        isActive: true,
        ...(isTrendingValue !== undefined && { isTrending: isTrendingValue }),
        ...(category && typeof category === 'string' && category.trim() && { category: { contains: category.trim(), mode: 'insensitive' } })
      },
      orderBy: {
        createdAt: 'desc'
      }
    };

    // Count total records with filter
    const totalCount = await prisma.news.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const news = await prisma.news.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        news,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'Public news retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching public news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public news',
      error: error.message
    });
  }
};

// List news id+title for moderation dropdown (protected)
exports.getNewsListForModeration = async (req, res) => {
  try {
    const { q = '', limit = 30 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 30, 100);
    const where = {};
    if (q && typeof q === 'string' && q.trim()) {
      where.title = { contains: q.trim() };
    }
    const list = await prisma.news.findMany({
      where,
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum
    });
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching news list for moderation:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch news list' });
  }
};

// Get trending news (active and trending only)
exports.getTrendingNews = async (req, res) => {
  try {
    const news = await prisma.news.findMany({
      where: {
        isActive: true,
        isTrending: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: news,
      message: 'Trending news retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching trending news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching trending news',
      error: error.message
    });
  }
};

// Get news by ID
exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const news = await prisma.news.findUnique({
      where: { id }
    });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: news,
      message: 'News retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching news',
      error: error.message
    });
  }
};

// Helper function to get image URL from uploaded file
const getImageUrl = (file) => {
  if (!file) return null;
  return getFileUrl(file.path);
};

// Create new news
exports.createNews = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      isTrending = false,
      isActive = true,
      commentsEnabled = false
    } = req.body;

    // Validate required fields
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, and category are required fields'
      });
    }

    // Handle image upload if present
    let imageUrl = null;
    if (req.file) {
      try {
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only image files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'Image file size exceeds 10MB limit.'
          });
        }

        imageUrl = getImageUrl(req.file);
      } catch (uploadError) {
        console.error('Error processing image:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing image',
          error: uploadError.message
        });
      }
    }

    const news = await prisma.news.create({
      data: {
        title,
        content,
        category,
        isTrending: Boolean(isTrending),
        isActive: Boolean(isActive),
        commentsEnabled: Boolean(commentsEnabled),
        imageUrl
      }
    });

    // Send notifications to subscribers asynchronously (don't block response)
    if (Boolean(isActive)) {
      const { sendNewArticleNotification } = require('../utils/email');
      // Fire and forget - don't wait for completion
      sendNewArticleNotification({
        title,
        content,
        category,
        type: 'news',
        id: news.id,
        isActive: Boolean(isActive)
      }).catch(error => {
        console.error('Failed to send news notifications:', error);
        // Don't throw - notification failure shouldn't affect article creation
      });
    }

    return res.status(201).json({
      success: true,
      data: news,
      message: 'News created successfully'
    });
  } catch (error) {
    console.error('Error creating news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating news',
      error: error.message
    });
  }
};

// Update news
exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      isTrending,
      isActive,
      commentsEnabled
    } = req.body;

    // Check if news exists
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }

    // Handle image upload if present
    let imageUrl = undefined;
    if (req.file) {
      try {
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only image files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'Image file size exceeds 10MB limit.'
          });
        }

        imageUrl = getImageUrl(req.file);
      } catch (uploadError) {
        console.error('Error processing image:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing image',
          error: uploadError.message
        });
      }
    } else {
      // Preserve existing image if no new image is uploaded
      imageUrl = existingNews.imageUrl;
    }

    // Update news
    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(isTrending !== undefined && { isTrending: Boolean(isTrending) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(commentsEnabled !== undefined && { commentsEnabled: Boolean(commentsEnabled) }),
        ...(imageUrl !== undefined && { imageUrl })
      }
    });

    // Send notifications if article was just activated (was inactive, now active)
    if (isActive !== undefined && Boolean(isActive) && !existingNews.isActive) {
      const { sendNewArticleNotification } = require('../utils/email');
      sendNewArticleNotification({
        title: updatedNews.title,
        content: updatedNews.content,
        category: updatedNews.category,
        type: 'news',
        id: updatedNews.id,
        isActive: Boolean(isActive)
      }).catch(error => {
        console.error('Failed to send news notifications:', error);
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedNews,
      message: 'News updated successfully'
    });
  } catch (error) {
    console.error('Error updating news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating news',
      error: error.message
    });
  }
};

// Delete news
exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if news exists
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }

    // Delete associated image file if it exists
    if (existingNews.imageUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const urlPath = existingNews.imageUrl.startsWith('http') 
          ? new URL(existingNews.imageUrl).pathname 
          : existingNews.imageUrl;
        const filePath = path.join(__dirname, '..', urlPath.startsWith('/') ? urlPath.substring(1) : urlPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error('Error deleting image file:', fileError);
        // Continue with deletion even if file deletion fails
      }
    }

    // Delete news
    await prisma.news.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'News deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting news',
      error: error.message
    });
  }
};

// Toggle news status
exports.toggleNewsStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if news exists
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }

    // Toggle status
    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        isActive: !existingNews.isActive
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedNews,
      message: 'News status toggled successfully'
    });
  } catch (error) {
    console.error('Error toggling news status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling news status',
      error: error.message
    });
  }
};

// Toggle trending status
exports.toggleTrendingStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if news exists
    const existingNews = await prisma.news.findUnique({
      where: { id }
    });

    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }

    // Toggle trending status
    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        isTrending: !existingNews.isTrending
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedNews,
      message: 'News trending status toggled successfully'
    });
  } catch (error) {
    console.error('Error toggling news trending status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling news trending status',
      error: error.message
    });
  }
};
