// controllers/advertisementController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

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

// Helper function to delete old file when updating
const deleteOldFile = (fileUrl) => {
  if (!fileUrl) return;
  
  try {
    // Extract file path from URL
    const urlPath = fileUrl.startsWith('http') 
      ? new URL(fileUrl).pathname 
      : fileUrl;
    
    // Remove leading slash and construct full path
    const filePath = path.join(__dirname, '..', urlPath.startsWith('/') ? urlPath.substring(1) : urlPath);
    
    // Check if file exists and delete
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted old file:', filePath);
    }
  } catch (error) {
    console.error('Error deleting old file:', error);
    // Don't throw - file deletion failure shouldn't block updates
  }
};

// Helper function to get PDF URL from uploaded file
const getPdfUrl = (file) => {
  if (!file) return null;
  return getFileUrl(file.path);
};

// Helper function to get image URL from uploaded file
const getImageUrl = (file) => {
  if (!file) return null;
  return getFileUrl(file.path);
};

// Get all advertisements with filtering and pagination
exports.getAllAdvertisements = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      active,
      category,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Parse query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const isFeatured = featured === 'true' ? true : featured === 'false' ? false : undefined;

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
        ...(isFeatured !== undefined && { isFeatured }),
        ...(category && typeof category === 'string' && category.trim() && { category: { contains: category.trim(), mode: 'insensitive' } })
      },
      orderBy: {
        [sortBy]: sortOrder?.toLowerCase() || 'desc'
      }
    };

    // Count total records with filter
    const totalCount = await prisma.advertisement.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const advertisements = await prisma.advertisement.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        advertisements,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'Advertisements retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisements',
      error: error.message
    });
  }
};

// Get public advertisements (active only)
exports.getPublicAdvertisements = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      featured
    } = req.query;

    // Parse query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const isFeatured = featured === 'true' ? true : undefined;

    // Build filter object
    const filter = {
      where: {
        isActive: true,
        ...(isFeatured !== undefined && { isFeatured }),
        ...(category && typeof category === 'string' && category.trim() && { category: { contains: category.trim(), mode: 'insensitive' } })
      },
      orderBy: {
        createdAt: 'desc'
      }
    };

    // Count total records with filter
    const totalCount = await prisma.advertisement.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const advertisements = await prisma.advertisement.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        advertisements,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'Public advertisements retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching public advertisements:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public advertisements',
      error: error.message
    });
  }
};

// Get featured advertisements (active and featured only)
exports.getFeaturedAdvertisements = async (req, res) => {
  try {
    const advertisements = await prisma.advertisement.findMany({
      where: {
        isActive: true,
        isFeatured: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: advertisements,
      message: 'Featured advertisements retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching featured advertisements:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching featured advertisements',
      error: error.message
    });
  }
};

// Get advertisement by ID
exports.getAdvertisementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const advertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: advertisement,
      message: 'Advertisement retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching advertisement:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisement',
      error: error.message
    });
  }
};


// Create new advertisement
exports.createAdvertisement = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      isFeatured = false,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, and category are required fields'
      });
    }

    let pdfUrl = null;
    let imageUrl = null;

    // Check if PDF file was uploaded
    if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
      try {
        const pdfFile = req.files.pdfFile[0];
        
        // Validate file type
        if (pdfFile.mimetype !== 'application/pdf') {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only PDF files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (pdfFile.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'PDF file size exceeds 10MB limit.'
          });
        }

        pdfUrl = getPdfUrl(pdfFile);
      } catch (uploadError) {
        console.error('Error processing PDF:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing PDF file',
          error: uploadError.message
        });
      }
    }

    // Check if image file was uploaded
    if (req.files && req.files.imageFile && req.files.imageFile[0]) {
      try {
        const imageFile = req.files.imageFile[0];
        
        // Validate file type
        if (!imageFile.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only image files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (imageFile.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'Image file size exceeds 10MB limit.'
          });
        }

        imageUrl = getImageUrl(imageFile);
      } catch (uploadError) {
        console.error('Error processing image:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing image file',
          error: uploadError.message
        });
      }
    }

    const advertisement = await prisma.advertisement.create({
      data: {
        title,
        content,
        category,
        isFeatured: Boolean(isFeatured),
        isActive: Boolean(isActive),
        ...(pdfUrl && { pdfUrl }),
        ...(imageUrl && { imageUrl })
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
        type: 'advertisement',
        id: advertisement.id,
        isActive: Boolean(isActive)
      }).catch(error => {
        console.error('Failed to send advertisement notifications:', error);
        // Don't throw - notification failure shouldn't affect advertisement creation
      });
    }

    return res.status(201).json({
      success: true,
      data: advertisement,
      message: 'Advertisement created successfully'
    });
  } catch (error) {
    console.error('Error creating advertisement:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating advertisement',
      error: error.message
    });
  }
};

// Update advertisement
exports.updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      isFeatured,
      isActive
    } = req.body;

    // Check if advertisement exists
    const existingAdvertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!existingAdvertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    let pdfUrl = existingAdvertisement.pdfUrl;
    let imageUrl = existingAdvertisement.imageUrl;

    // Check if new PDF file was uploaded
    if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
      try {
        const pdfFile = req.files.pdfFile[0];
        
        // Validate file type
        if (pdfFile.mimetype !== 'application/pdf') {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only PDF files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (pdfFile.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'PDF file size exceeds 10MB limit.'
          });
        }

        // Delete old PDF file if it exists
        if (existingAdvertisement.pdfUrl) {
          deleteOldFile(existingAdvertisement.pdfUrl);
        }

        pdfUrl = getPdfUrl(pdfFile);
      } catch (uploadError) {
        console.error('Error processing PDF:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing PDF file',
          error: uploadError.message
        });
      }
    }

    // Check if new image file was uploaded
    if (req.files && req.files.imageFile && req.files.imageFile[0]) {
      try {
        const imageFile = req.files.imageFile[0];
        
        // Validate file type
        if (!imageFile.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only image files are allowed.'
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (imageFile.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: 'Image file size exceeds 10MB limit.'
          });
        }

        // Delete old image file if it exists
        if (existingAdvertisement.imageUrl) {
          deleteOldFile(existingAdvertisement.imageUrl);
        }

        imageUrl = getImageUrl(imageFile);
      } catch (uploadError) {
        console.error('Error processing image:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error processing image file',
          error: uploadError.message
        });
      }
    }

    // Update advertisement
    const updatedAdvertisement = await prisma.advertisement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured === 'true' || isFeatured === true) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive === 'true' || isActive === true) }),
        ...(pdfUrl !== existingAdvertisement.pdfUrl && { pdfUrl }),
        ...(imageUrl !== existingAdvertisement.imageUrl && { imageUrl })
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedAdvertisement,
      message: 'Advertisement updated successfully'
    });
  } catch (error) {
    console.error('Error updating advertisement:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating advertisement',
      error: error.message
    });
  }
};

// Delete advertisement
exports.deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if advertisement exists
    const existingAdvertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!existingAdvertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Delete associated files
    if (existingAdvertisement.pdfUrl) {
      deleteOldFile(existingAdvertisement.pdfUrl);
    }
    if (existingAdvertisement.imageUrl) {
      deleteOldFile(existingAdvertisement.imageUrl);
    }

    // Delete advertisement
    await prisma.advertisement.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting advertisement:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting advertisement',
      error: error.message
    });
  }
};

// Toggle advertisement status
exports.toggleAdvertisementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if advertisement exists
    const existingAdvertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!existingAdvertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Toggle status
    const updatedAdvertisement = await prisma.advertisement.update({
      where: { id },
      data: {
        isActive: !existingAdvertisement.isActive
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedAdvertisement,
      message: 'Advertisement status toggled successfully'
    });
  } catch (error) {
    console.error('Error toggling advertisement status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling advertisement status',
      error: error.message
    });
  }
};

// Toggle featured status
exports.toggleFeaturedStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if advertisement exists
    const existingAdvertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!existingAdvertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Toggle featured status
    const updatedAdvertisement = await prisma.advertisement.update({
      where: { id },
      data: {
        isFeatured: !existingAdvertisement.isFeatured
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedAdvertisement,
      message: 'Advertisement featured status toggled successfully'
    });
  } catch (error) {
    console.error('Error toggling featured status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling featured status',
      error: error.message
    });
  }
};

