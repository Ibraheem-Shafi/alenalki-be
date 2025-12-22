// controllers/sponsorController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate file URL
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

// Get all sponsors
exports.getAllSponsors = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    
    // Handle search - search in name and description
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Handle filters - only apply if they have actual values (not empty strings)
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
      where.isActive = isActive === 'true';
    }
    
    const [sponsors, total] = await Promise.all([
      prisma.sponsor.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { displayOrder: 'asc' }
      }),
      prisma.sponsor.count({ where })
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        sponsors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching sponsors:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching sponsors',
      error: error.message
    });
  }
};

// Get public sponsors
exports.getPublicSponsors = async (req, res) => {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
    
    return res.status(200).json({
      success: true,
      data: sponsors
    });
  } catch (error) {
    console.error('Error fetching public sponsors:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public sponsors',
      error: error.message
    });
  }
};

// Get sponsor by ID
exports.getSponsorById = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await prisma.sponsor.findUnique({
      where: { id }
    });
    
    if (!sponsor) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: sponsor
    });
  } catch (error) {
    console.error('Error fetching sponsor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching sponsor',
      error: error.message
    });
  }
};

// Create sponsor
exports.createSponsor = async (req, res) => {
  try {
    const {
      name,
      websiteUrl,
      description,
      isActive,
      displayOrder,
      sponsorDayDate,
      eventIds
    } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }
    
    let logoUrl = null;
    if (req.file) {
      // Single file upload (upload.single('logoFile'))
      logoUrl = getFileUrl(req.file.path);
    }
    
    const sponsor = await prisma.sponsor.create({
      data: {
        name,
        logoUrl,
        websiteUrl,
        description,
        isActive: isActive !== undefined ? (isActive === true || isActive === 'true' || isActive === '1') : true,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
        sponsorDayDate: sponsorDayDate ? new Date(sponsorDayDate) : null,
        eventIds: eventIds ? (Array.isArray(eventIds) ? eventIds : [eventIds]) : []
      }
    });
    
    return res.status(201).json({
      success: true,
      data: sponsor,
      message: 'Sponsor created successfully'
    });
  } catch (error) {
    console.error('Error creating sponsor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating sponsor',
      error: error.message
    });
  }
};

// Update sponsor
exports.updateSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const existing = await prisma.sponsor.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }
    
    // Handle file upload
    if (req.file) {
      // Single file upload (upload.single('logoFile'))
      updateData.logoUrl = getFileUrl(req.file.path);
    }
    
    // Convert dates
    if (updateData.sponsorDayDate) {
      updateData.sponsorDayDate = new Date(updateData.sponsorDayDate);
    }
    
    // Convert boolean fields from strings to actual booleans
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === true || updateData.isActive === 'true' || updateData.isActive === '1';
    }
    
    // Convert displayOrder to integer if it's a string
    if (updateData.displayOrder !== undefined && typeof updateData.displayOrder === 'string') {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    
    // Handle eventIds array
    if (updateData.eventIds !== undefined) {
      updateData.eventIds = Array.isArray(updateData.eventIds) 
        ? updateData.eventIds 
        : [updateData.eventIds];
    }
    
    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: updateData
    });
    
    return res.status(200).json({
      success: true,
      data: sponsor,
      message: 'Sponsor updated successfully'
    });
  } catch (error) {
    console.error('Error updating sponsor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating sponsor',
      error: error.message
    });
  }
};

// Delete sponsor
exports.deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sponsor = await prisma.sponsor.findUnique({
      where: { id }
    });
    
    if (!sponsor) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }
    
    await prisma.sponsor.delete({
      where: { id }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Sponsor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sponsor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting sponsor',
      error: error.message
    });
  }
};

// Toggle sponsor status
exports.toggleSponsorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await prisma.sponsor.findUnique({
      where: { id }
    });
    
    if (!sponsor) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }
    
    const updated = await prisma.sponsor.update({
      where: { id },
      data: { isActive: !sponsor.isActive }
    });
    
    return res.status(200).json({
      success: true,
      data: updated,
      message: `Sponsor ${updated.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling sponsor status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling sponsor status',
      error: error.message
    });
  }
};

