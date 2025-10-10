const express = require('express');
const router = express.Router();
const ScrapingOperation = require('../models/scrapingOperation.model');
const ScrapeLog = require('../models/scrapeLog.model');
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');

// Helper function to create scrape log
async function createScrapeLog(operation, status, action = 'Manual') {
    try {
        const scrapeLog = new ScrapeLog({
            when: new Date(),
            platform: operation.seller,
            type: operation.type,
            url: operation.url,
            category: operation.category || '',
            status: status,
            action: action,
            operationId: operation._id
        });
        
        await scrapeLog.save();
        return scrapeLog;
    } catch (error) {
        console.error('Error creating scrape log:', error);
        // Don't throw error to avoid breaking the main operation
        return null;
    }
}

// Validation schemas
const createOperationSchema = Joi.object({
    url: Joi.string().uri().required(),
    seller: Joi.string().valid(
        'amazon', 'flipkart', 'tatacliq', 'myntra', 'jiomart', 'ajio', 
        'chroma', 'vijaysales', 'nykaa', '1mg', 'pharmeasy', 'netmeds',
        'blinkit', 'swiggy-instamart', 'zepto', 'bigbasket', 'pepperfry',
        'homecentre', 'shoppersstop', 'urbanic', 'ikea', 'biba',
        'lifestylestores', 'medplusmart', 'truemeds', 'apollopharmacy',
        'wellnessforever', 'dmart', 'licious'
    ).required(),
    type: Joi.string().valid('product', 'category').default('product'),
    category: Joi.string().optional(),
    config: Joi.object({
        usePuppeteer: Joi.boolean().default(true),
        timeout: Joi.number().min(5000).max(120000).default(30000),
        waitTime: Joi.number().min(1000).max(10000).default(3000)
    }).optional(),
    notes: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

const updateOperationSchema = Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'success', 'failed', 'cancelled').optional(),
    progress: Joi.object({
        current: Joi.number().min(0).optional(),
        total: Joi.number().min(0).optional()
    }).optional(),
    errorMessage: Joi.string().optional(),
    errorDetails: Joi.any().optional(),
    notes: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

// GET /api/scraping-operations - Get all scraping operations with filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            seller,
            type,
            category,
            startDate,
            endDate,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (status) filter.status = status;
        if (seller) filter.seller = seller;
        if (type) filter.type = type;
        if (category) filter.category = new RegExp(category, 'i');
        
        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        
        // Search filter
        if (search) {
            filter.$or = [
                { url: new RegExp(search, 'i') },
                { category: new RegExp(search, 'i') },
                { notes: new RegExp(search, 'i') }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const operations = await ScrapingOperation.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-scrapedData -errorDetails'); // Exclude large fields for list view

        const total = await ScrapingOperation.countDocuments(filter);

        res.json({
            success: true,
            data: operations,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching scraping operations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scraping operations',
            error: error.message
        });
    }
});

// GET /api/scraping-operations/stats - Get statistics
router.get('/stats', async (req, res) => {
    try {
        const { seller, startDate, endDate } = req.query;
        
        const filter = {};
        if (seller) filter.seller = seller;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const [
            statusStats,
            sellerStats,
            recentOperations,
            totalOperations,
            totalProducts
        ] = await Promise.all([
            ScrapingOperation.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalProducts: { $sum: '$totalProducts' },
                        avgDuration: { $avg: '$duration' }
                    }
                }
            ]),
            ScrapingOperation.getSellerStats(),
            ScrapingOperation.getRecentOperations(5),
            ScrapingOperation.countDocuments(filter),
            ScrapingOperation.aggregate([
                { $match: filter },
                { $group: { _id: null, total: { $sum: '$totalProducts' } } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                statusStats,
                sellerStats,
                recentOperations,
                summary: {
                    totalOperations,
                    totalProducts: totalProducts[0]?.total || 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

// GET /api/scraping-operations/:id - Get single operation
router.get('/:id', async (req, res) => {
    try {
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        res.json({
            success: true,
            data: operation
        });
    } catch (error) {
        console.error('Error fetching operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch operation',
            error: error.message
        });
    }
});

// POST /api/scraping-operations - Create new scraping operation
router.post('/', async (req, res) => {
    try {
        const { error, value } = createOperationSchema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(detail => detail.message)
            });
        }

        // Check if operation already exists for this URL
        const existingOperation = await ScrapingOperation.findOne({
            url: value.url,
            status: { $in: ['pending', 'in_progress'] }
        });

        if (existingOperation) {
            return res.status(409).json({
                success: false,
                message: 'An operation is already in progress for this URL',
                data: existingOperation
            });
        }

        const operation = new ScrapingOperation({
            ...value,
            attemptTime: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestHeaders: req.headers
        });

        await operation.save();

        // Create initial scrape log
        await createScrapeLog(operation, 'pending', 'Manual');

        res.status(201).json({
            success: true,
            message: 'Scraping operation created successfully',
            data: operation
        });
    } catch (error) {
        console.error('Error creating operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create scraping operation',
            error: error.message
        });
    }
});

// PUT /api/scraping-operations/:id - Update operation
router.put('/:id', async (req, res) => {
    try {
        const { error, value } = updateOperationSchema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(detail => detail.message)
            });
        }

        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        // Update fields
        Object.keys(value).forEach(key => {
            operation[key] = value[key];
        });

        await operation.save();

        res.json({
            success: true,
            message: 'Operation updated successfully',
            data: operation
        });
    } catch (error) {
        console.error('Error updating operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update operation',
            error: error.message
        });
    }
});

// POST /api/scraping-operations/:id/start - Mark operation as started
router.post('/:id/start', async (req, res) => {
    try {
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        if (operation.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Operation is not in pending status'
            });
        }

        await operation.markAsStarted();

        res.json({
            success: true,
            message: 'Operation started successfully',
            data: operation
        });
    } catch (error) {
        console.error('Error starting operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start operation',
            error: error.message
        });
    }
});

// POST /api/scraping-operations/:id/complete - Mark operation as completed
router.post('/:id/complete', async (req, res) => {
    try {
        const { scrapedData, totalProducts, dataFile } = req.body;
        
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        if (operation.status !== 'in_progress') {
            return res.status(400).json({
                success: false,
                message: 'Operation is not in progress'
            });
        }

        await operation.markAsCompleted(scrapedData, totalProducts);
        
        // Update data file path if provided
        if (dataFile) {
            operation.dataFile = dataFile;
            await operation.save();
        }

        res.json({
            success: true,
            message: 'Operation completed successfully',
            data: operation
        });
    } catch (error) {
        console.error('Error completing operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete operation',
            error: error.message
        });
    }
});

// POST /api/scraping-operations/:id/fail - Mark operation as failed
router.post('/:id/fail', async (req, res) => {
    try {
        const { errorMessage, errorDetails } = req.body;
        
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        await operation.markAsFailed(errorMessage, errorDetails);

        res.json({
            success: true,
            message: 'Operation marked as failed',
            data: operation
        });
    } catch (error) {
        console.error('Error failing operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark operation as failed',
            error: error.message
        });
    }
});

// POST /api/scraping-operations/:id/retry - Retry failed operation
router.post('/:id/retry', async (req, res) => {
    try {
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        if (operation.status !== 'failed') {
            return res.status(400).json({
                success: false,
                message: 'Only failed operations can be retried'
            });
        }

        if (operation.retryCount >= operation.maxRetries) {
            return res.status(400).json({
                success: false,
                message: 'Maximum retry limit reached'
            });
        }

        await operation.incrementRetry();

        res.json({
            success: true,
            message: 'Operation queued for retry',
            data: operation
        });
    } catch (error) {
        console.error('Error retrying operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retry operation',
            error: error.message
        });
    }
});

// DELETE /api/scraping-operations/:id - Delete operation
router.delete('/:id', async (req, res) => {
    try {
        const operation = await ScrapingOperation.findById(req.params.id);
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        // Delete associated data file if it exists
        if (operation.dataFile) {
            try {
                await fs.unlink(operation.dataFile);
            } catch (fileError) {
                console.warn('Could not delete data file:', fileError.message);
            }
        }

        await ScrapingOperation.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Operation deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete operation',
            error: error.message
        });
    }
});

// GET /api/scraping-operations/:id/data - Get scraped data
router.get('/:id/data', async (req, res) => {
    try {
        const operation = await ScrapingOperation.findById(req.params.id)
            .select('scrapedData dataFile status');
        
        if (!operation) {
            return res.status(404).json({
                success: false,
                message: 'Scraping operation not found'
            });
        }

        if (operation.status !== 'success') {
            return res.status(400).json({
                success: false,
                message: 'Operation has not completed successfully'
            });
        }

        // Try to get data from database first
        if (operation.scrapedData) {
            return res.json({
                success: true,
                data: operation.scrapedData
            });
        }

        // Fallback to file if available
        if (operation.dataFile) {
            try {
                const fileData = await fs.readFile(operation.dataFile, 'utf8');
                const parsedData = JSON.parse(fileData);
                return res.json({
                    success: true,
                    data: parsedData
                });
            } catch (fileError) {
                console.error('Error reading data file:', fileError);
            }
        }

        res.status(404).json({
            success: false,
            message: 'No scraped data found'
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scraped data',
            error: error.message
        });
    }
});

module.exports = router;
