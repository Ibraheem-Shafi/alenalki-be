// controllers/blogController.js
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

// Get all blogs with filtering and pagination
exports.getAllBlogs = async (req, res) => {
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
    const totalCount = await prisma.blog.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const blogs = await prisma.blog.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'Blogs retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
};

// List blogs id+title for moderation dropdown (protected)
exports.getBlogListForModeration = async (req, res) => {
  try {
    const { q = '', limit = 30 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 30, 100);
    const where = {};
    if (q && typeof q === 'string' && q.trim()) {
      where.title = { contains: q.trim() };
    }
    const list = await prisma.blog.findMany({
      where,
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum
    });
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching blog list for moderation:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blog list' });
  }
};

// Get public blogs (active only)
exports.getPublicBlogs = async (req, res) => {
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
    const totalCount = await prisma.blog.count(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get records with pagination
    const blogs = await prisma.blog.findMany({
      ...filter,
      skip,
      take: limitNum
    });

    return res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          total: totalCount,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      },
      message: 'Public blogs retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching public blogs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public blogs',
      error: error.message
    });
  }
};

// Get featured blogs (active and featured only)
exports.getFeaturedBlogs = async (req, res) => {
  try {
    const blogs = await prisma.blog.findMany({
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
      data: blogs,
      message: 'Featured blogs retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching featured blogs',
      error: error.message
    });
  }
};

// Get blog by ID
exports.getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await prisma.blog.findUnique({
      where: { id }
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: blog,
      message: 'Blog retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message
    });
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

// Create new blog
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      isFeatured = false,
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

    const blog = await prisma.blog.create({
      data: {
        title,
        content,
        category,
        isFeatured: Boolean(isFeatured),
        isActive: Boolean(isActive),
        commentsEnabled: Boolean(commentsEnabled),
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
        type: 'blog',
        id: blog.id,
        isActive: Boolean(isActive)
      }).catch(error => {
        console.error('Failed to send blog notifications:', error);
        // Don't throw - notification failure shouldn't affect article creation
      });
    }

    return res.status(201).json({
      success: true,
      data: blog,
      message: 'Blog created successfully'
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating blog',
      error: error.message
    });
  }
};

// Update blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      isFeatured,
      isActive,
      commentsEnabled
    } = req.body;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id }
    });

    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    let pdfUrl = existingBlog.pdfUrl;
    let imageUrl = existingBlog.imageUrl;

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
        if (existingBlog.pdfUrl) {
          deleteOldFile(existingBlog.pdfUrl);
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
        if (existingBlog.imageUrl) {
          deleteOldFile(existingBlog.imageUrl);
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

    // Update blog
    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured === 'true' || isFeatured === true) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive === 'true' || isActive === true) }),
        ...(commentsEnabled !== undefined && { commentsEnabled: Boolean(commentsEnabled === 'true' || commentsEnabled === true) }),
        ...(pdfUrl !== existingBlog.pdfUrl && { pdfUrl }),
        ...(imageUrl !== existingBlog.imageUrl && { imageUrl })
      }
    });

    // Send notifications if article was just activated (was inactive, now active)
    if (isActive !== undefined && Boolean(isActive === 'true' || isActive === true) && !existingBlog.isActive) {
      const { sendNewArticleNotification } = require('../utils/email');
      sendNewArticleNotification({
        title: updatedBlog.title,
        content: updatedBlog.content,
        category: updatedBlog.category,
        type: 'blog',
        id: updatedBlog.id,
        isActive: Boolean(isActive === 'true' || isActive === true)
      }).catch(error => {
        console.error('Failed to send blog notifications:', error);
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedBlog,
      message: 'Blog updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating blog',
      error: error.message
    });
  }
};

// Delete blog
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id }
    });

    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Delete associated files
    if (existingBlog.pdfUrl) {
      deleteOldFile(existingBlog.pdfUrl);
    }
    if (existingBlog.imageUrl) {
      deleteOldFile(existingBlog.imageUrl);
    }

    // Delete blog
    await prisma.blog.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting blog',
      error: error.message
    });
  }
};

// Toggle blog status
exports.toggleBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id }
    });

    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Toggle status
    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        isActive: !existingBlog.isActive
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedBlog,
      message: 'Blog status toggled successfully'
    });
  } catch (error) {
    console.error('Error toggling blog status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling blog status',
      error: error.message
    });
  }
};

// Toggle featured status
exports.toggleFeaturedStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id }
    });

    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Toggle featured status
    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        isFeatured: !existingBlog.isFeatured
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedBlog,
      message: 'Blog featured status toggled successfully'
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
