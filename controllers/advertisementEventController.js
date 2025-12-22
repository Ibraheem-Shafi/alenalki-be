// controllers/advertisementEventController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

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

// Get all advertisement events
exports.getAllAdvertisementEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, isFeatured, upcoming, past, eventType, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    
    // Handle search - search in title and description
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Handle filters - only apply if they have actual values (not empty strings)
    if (isActive !== undefined && isActive !== '' && isActive !== null) {
      where.isActive = isActive === 'true';
    }
    if (isFeatured !== undefined && isFeatured !== '' && isFeatured !== null) {
      where.isFeatured = isFeatured === 'true';
    }
    if (eventType && eventType.trim()) {
      where.eventType = eventType;
    }
    
    const now = new Date();
    if (upcoming === 'true') {
      where.startDate = { gte: now };
    } else if (past === 'true') {
      where.startDate = { lt: now };
    }
    
    const [events, total] = await Promise.all([
      prisma.advertisementEvent.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startDate: 'asc' }
      }),
      prisma.advertisementEvent.count({ where })
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching advertisement events:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisement events',
      error: error.message
    });
  }
};

// Get public advertisement events
exports.getPublicAdvertisementEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, upcoming } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = { isActive: true };
    const now = new Date();
    if (upcoming === 'true' || !upcoming) {
      where.startDate = { gte: now };
    }
    
    const [events, total] = await Promise.all([
      prisma.advertisementEvent.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startDate: 'asc' }
      }),
      prisma.advertisementEvent.count({ where })
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching public advertisement events:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public advertisement events',
      error: error.message
    });
  }
};

// Get featured advertisement event
exports.getFeaturedAdvertisementEvent = async (req, res) => {
  try {
    const now = new Date();
    const event = await prisma.advertisementEvent.findFirst({
      where: {
        isFeatured: true,
        isActive: true,
        startDate: { gte: now }
      },
      orderBy: { startDate: 'asc' }
    });
    
    return res.status(200).json({
      success: true,
      data: event || null
    });
  } catch (error) {
    console.error('Error fetching featured event:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching featured event',
      error: error.message
    });
  }
};

// Get events for calendar
exports.getCalendarEvents = async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    
    // Get events
    const events = await prisma.advertisementEvent.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { sponsorDayDate: { gte: startDate, lte: endDate } },
          { deadlineDate: { gte: startDate, lte: endDate } }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        eventType: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        location: true,
        isOnline: true,
        isFeatured: true,
        isActive: true,
        imageUrl: true,
        actionButtonText: true,
        actionButtonUrl: true,
        actionButtonColor: true,
        sponsorDayDate: true,
        deadlineDate: true,
        displayOrder: true,
        backgroundColor: true,
        icon: true,
        sponsorIds: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Get sponsors with sponsorDayDate in the date range
    const sponsors = await prisma.sponsor.findMany({
      where: {
        isActive: true,
        sponsorDayDate: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        name: true,
        sponsorDayDate: true
      }
    });
    
    // Combine events and sponsors, marking sponsors with a type
    const calendarItems = [
      ...events,
      ...sponsors.map(sponsor => ({
        id: sponsor.id,
        title: sponsor.name,
        sponsorDayDate: sponsor.sponsorDayDate,
        isSponsorDay: true // Flag to identify sponsor days
      }))
    ];
    
    return res.status(200).json({
      success: true,
      data: calendarItems
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching calendar events',
      error: error.message
    });
  }
};

// Get advertisement event by ID
exports.getAdvertisementEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.advertisementEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement event not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching advertisement event:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching advertisement event',
      error: error.message
    });
  }
};

// Create advertisement event
exports.createAdvertisementEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      isOnline,
      isFeatured,
      isActive,
      actionButtonText,
      actionButtonUrl,
      actionButtonColor,
      sponsorDayDate,
      deadlineDate,
      displayOrder,
      backgroundColor,
      icon,
      sponsorIds
    } = req.body;
    
    if (!title || !description || !eventType || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, eventType, and startDate are required'
      });
    }
    
    let imageUrl = null;
    if (req.file) {
      // Single file upload (upload.single('imageFile'))
      try {
        imageUrl = getFileUrl(req.file.path);
        if (!imageUrl) {
          console.error('Failed to generate imageUrl from path:', req.file.path);
        } else {
          console.log('Image uploaded successfully, URL:', imageUrl);
        }
      } catch (error) {
        console.error('Error processing image file:', error);
      }
    } else {
      console.log('No image file received in request');
    }
    
    // If setting to featured, unfeature all other events first
    if (isFeatured === 'true' || isFeatured === true || isFeatured === '1') {
      await prisma.advertisementEvent.updateMany({
        where: { isFeatured: true },
        data: { isFeatured: false }
      });
    }
    
    const event = await prisma.advertisementEvent.create({
      data: {
        title,
        description,
        eventType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        startTime,
        endTime,
        location,
        isOnline: isOnline === true || isOnline === 'true' || isOnline === '1',
        isFeatured: isFeatured === true || isFeatured === 'true' || isFeatured === '1',
        isActive: isActive !== undefined ? (isActive === true || isActive === 'true' || isActive === '1') : true,
        imageUrl,
        actionButtonText,
        actionButtonUrl,
        actionButtonColor,
        sponsorDayDate: sponsorDayDate ? new Date(sponsorDayDate) : null,
        deadlineDate: deadlineDate ? new Date(deadlineDate) : null,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
        backgroundColor,
        icon,
        sponsorIds: sponsorIds ? (Array.isArray(sponsorIds) ? sponsorIds : [sponsorIds]) : []
      }
    });
    
    return res.status(201).json({
      success: true,
      data: event,
      message: 'Advertisement event created successfully'
    });
  } catch (error) {
    console.error('Error creating advertisement event:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating advertisement event',
      error: error.message
    });
  }
};

// Update advertisement event
exports.updateAdvertisementEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const existing = await prisma.advertisementEvent.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement event not found'
      });
    }
    
    // Handle file upload
    if (req.file) {
      // Single file upload (upload.single('imageFile'))
      updateData.imageUrl = getFileUrl(req.file.path);
    }
    
    // If setting to featured, unfeature all other events first
    if (updateData.isFeatured === 'true' || updateData.isFeatured === true || updateData.isFeatured === '1') {
      await prisma.advertisementEvent.updateMany({
        where: { 
          isFeatured: true,
          id: { not: id }
        },
        data: { isFeatured: false }
      });
    }
    
    // Convert dates
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    if (updateData.sponsorDayDate) updateData.sponsorDayDate = new Date(updateData.sponsorDayDate);
    if (updateData.deadlineDate) updateData.deadlineDate = new Date(updateData.deadlineDate);
    
    // Convert boolean fields from strings to actual booleans
    if (updateData.isOnline !== undefined) {
      updateData.isOnline = updateData.isOnline === true || updateData.isOnline === 'true' || updateData.isOnline === '1';
    }
    if (updateData.isFeatured !== undefined) {
      updateData.isFeatured = updateData.isFeatured === true || updateData.isFeatured === 'true' || updateData.isFeatured === '1';
    }
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === true || updateData.isActive === 'true' || updateData.isActive === '1';
    }
    
    // Convert displayOrder to integer if it's a string
    if (updateData.displayOrder !== undefined && typeof updateData.displayOrder === 'string') {
      updateData.displayOrder = parseInt(updateData.displayOrder) || 0;
    }
    
    // Handle sponsorIds array
    if (updateData.sponsorIds !== undefined) {
      updateData.sponsorIds = Array.isArray(updateData.sponsorIds) 
        ? updateData.sponsorIds 
        : [updateData.sponsorIds];
    }
    
    const event = await prisma.advertisementEvent.update({
      where: { id },
      data: updateData
    });
    
    return res.status(200).json({
      success: true,
      data: event,
      message: 'Advertisement event updated successfully'
    });
  } catch (error) {
    console.error('Error updating advertisement event:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating advertisement event',
      error: error.message
    });
  }
};

// Delete advertisement event
exports.deleteAdvertisementEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.advertisementEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement event not found'
      });
    }
    
    await prisma.advertisementEvent.delete({
      where: { id }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Advertisement event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting advertisement event:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting advertisement event',
      error: error.message
    });
  }
};

// Toggle event status
exports.toggleEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.advertisementEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement event not found'
      });
    }
    
    const updated = await prisma.advertisementEvent.update({
      where: { id },
      data: { isActive: !event.isActive }
    });
    
    return res.status(200).json({
      success: true,
      data: updated,
      message: `Event ${updated.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling event status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error toggling event status',
      error: error.message
    });
  }
};

// Toggle featured status
exports.toggleFeaturedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.advertisementEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement event not found'
      });
    }
    
    // If setting to featured, unfeature all other events first
    if (!event.isFeatured) {
      await prisma.advertisementEvent.updateMany({
        where: { 
          isFeatured: true,
          id: { not: id }
        },
        data: { isFeatured: false }
      });
    }
    
    const updated = await prisma.advertisementEvent.update({
      where: { id },
      data: { isFeatured: !event.isFeatured }
    });
    
    return res.status(200).json({
      success: true,
      data: updated,
      message: `Event ${updated.isFeatured ? 'featured' : 'unfeatured'} successfully`
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

