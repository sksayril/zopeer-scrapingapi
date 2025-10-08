const mongoose = require('mongoose');

const scrapingOperationSchema = new mongoose.Schema({
    // Basic Information
    url: {
        type: String,
        required: true,
        trim: true
    },
    seller: {
        type: String,
        required: true,
        enum: [
            'amazon', 'flipkart', 'tatacliq', 'myntra', 'jiomart', 'ajio', 
            'chroma', 'vijaysales', 'nykaa', '1mg', 'pharmeasy', 'netmeds',
            'blinkit', 'swiggy-instamart', 'zepto', 'bigbasket', 'pepperfry',
            'homecentre', 'shoppersstop', 'urbanic', 'ikea', 'biba',
            'lifestylestores', 'medplusmart', 'truemeds', 'apollopharmacy',
            'wellnessforever', 'dmart', 'licious'
        ]
    },
    type: {
        type: String,
        required: true,
        enum: ['product', 'category'],
        default: 'product'
    },
    category: {
        type: String,
        trim: true
    },
    
    // Status Tracking
    status: {
        type: String,
        required: true,
        enum: ['pending', 'in_progress', 'success', 'failed', 'cancelled'],
        default: 'pending'
    },
    
    // Timing Information
    attemptTime: {
        type: Date,
        default: Date.now
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // in milliseconds
        default: 0
    },
    
    // Results
    totalProducts: {
        type: Number,
        default: 0
    },
    scrapedProducts: {
        type: Number,
        default: 0
    },
    failedProducts: {
        type: Number,
        default: 0
    },
    
    // Error Information
    errorMessage: {
        type: String
    },
    errorDetails: {
        type: mongoose.Schema.Types.Mixed
    },
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    
    // Configuration
    config: {
        usePuppeteer: {
            type: Boolean,
            default: true
        },
        timeout: {
            type: Number,
            default: 30000
        },
        waitTime: {
            type: Number,
            default: 3000
        }
    },
    
    // Data Storage
    scrapedData: {
        type: mongoose.Schema.Types.Mixed
    },
    dataFile: {
        type: String // Path to saved JSON file
    },
    
    // Metadata
    userAgent: {
        type: String
    },
    ipAddress: {
        type: String
    },
    requestHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // Progress Tracking
    progress: {
        current: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            default: 0
        },
        percentage: {
            type: Number,
            default: 0
        }
    },
    
    // Additional Information
    notes: {
        type: String
    },
    tags: [{
        type: String
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'scraping_operations'
});

// Indexes for better query performance
scrapingOperationSchema.index({ url: 1 });
scrapingOperationSchema.index({ seller: 1 });
scrapingOperationSchema.index({ status: 1 });
scrapingOperationSchema.index({ type: 1 });
scrapingOperationSchema.index({ attemptTime: -1 });
scrapingOperationSchema.index({ createdAt: -1 });
scrapingOperationSchema.index({ seller: 1, status: 1 });
scrapingOperationSchema.index({ seller: 1, type: 1 });

// Pre-save middleware to update timestamps and calculate duration
scrapingOperationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Calculate duration if both start and end times are available
    if (this.startTime && this.endTime) {
        this.duration = this.endTime.getTime() - this.startTime.getTime();
    }
    
    // Calculate progress percentage
    if (this.progress.total > 0) {
        this.progress.percentage = Math.round((this.progress.current / this.progress.total) * 100);
    }
    
    next();
});

// Instance methods
scrapingOperationSchema.methods.markAsStarted = function() {
    this.status = 'in_progress';
    this.startTime = new Date();
    return this.save();
};

scrapingOperationSchema.methods.markAsCompleted = function(scrapedData, totalProducts) {
    this.status = 'success';
    this.endTime = new Date();
    this.scrapedData = scrapedData;
    this.totalProducts = totalProducts;
    this.scrapedProducts = totalProducts;
    this.progress.current = totalProducts;
    this.progress.total = totalProducts;
    this.progress.percentage = 100;
    return this.save();
};

scrapingOperationSchema.methods.markAsFailed = function(errorMessage, errorDetails) {
    this.status = 'failed';
    this.endTime = new Date();
    this.errorMessage = errorMessage;
    this.errorDetails = errorDetails;
    return this.save();
};

scrapingOperationSchema.methods.incrementRetry = function() {
    this.retryCount += 1;
    this.status = 'pending';
    this.attemptTime = new Date();
    return this.save();
};

// Static methods
scrapingOperationSchema.statics.getStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalProducts: { $sum: '$totalProducts' },
                avgDuration: { $avg: '$duration' }
            }
        }
    ]);
};

scrapingOperationSchema.statics.getSellerStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$seller',
                totalOperations: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                },
                failedCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                },
                pendingCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                },
                totalProducts: { $sum: '$totalProducts' }
            }
        },
        {
            $addFields: {
                successRate: {
                    $round: [
                        { $multiply: [{ $divide: ['$successCount', '$totalOperations'] }, 100] },
                        2
                    ]
                }
            }
        }
    ]);
};

scrapingOperationSchema.statics.getRecentOperations = function(limit = 10) {
    return this.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('url seller type status attemptTime totalProducts createdAt');
};

module.exports = mongoose.model('ScrapingOperation', scrapingOperationSchema);
