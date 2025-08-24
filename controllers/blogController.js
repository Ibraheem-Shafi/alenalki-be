// controllers/blogController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(category && { category: { contains: category, mode: 'insensitive' } })
      },
      orderBy: {
        [sortBy]: sortOrder.toLowerCase()
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
        ...(category && { category: { contains: category, mode: 'insensitive' } })
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

// Upload PDF to Cloudinary
const uploadPdfToCloudinary = async (pdfBuffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'blog_pdfs',
        format: 'pdf',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    ).end(pdfBuffer);
  });
};

// Upload image to Cloudinary
const uploadImageToCloudinary = async (imageBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'image',
      folder: 'blog_images',
    };

    cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.secure_url);
      }
    }).end(imageBuffer);
  });
};

// Create new blog
exports.createBlog = async (req, res) => {
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
        // Upload PDF to Cloudinary
        pdfUrl = await uploadPdfToCloudinary(req.files.pdfFile[0].buffer);
      } catch (uploadError) {
        console.error('Error uploading PDF to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading PDF file',
          error: uploadError.message
        });
      }
    }

    // Check if image file was uploaded
    if (req.files && req.files.imageFile && req.files.imageFile[0]) {
      try {
        // Upload image to Cloudinary
        imageUrl = await uploadImageToCloudinary(req.files.imageFile[0].buffer);
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image file',
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
        ...(pdfUrl && { pdfUrl }),
        ...(imageUrl && { imageUrl })
      }
    });

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
      isActive
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
        // Upload new PDF to Cloudinary
        pdfUrl = await uploadPdfToCloudinary(req.files.pdfFile[0].buffer);
      } catch (uploadError) {
        console.error('Error uploading PDF to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading PDF file',
          error: uploadError.message
        });
      }
    }

    // Check if new image file was uploaded
    if (req.files && req.files.imageFile && req.files.imageFile[0]) {
      try {
        // Upload new image to Cloudinary
        imageUrl = await uploadImageToCloudinary(req.files.imageFile[0].buffer);
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image file',
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
        ...(pdfUrl !== existingBlog.pdfUrl && { pdfUrl }),
        ...(imageUrl !== existingBlog.imageUrl && { imageUrl })
      }
    });

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
