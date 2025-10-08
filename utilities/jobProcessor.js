const ScrapingService = require('./scrapingService');
const ScrapingOperation = require('../models/scrapingOperation.model');

class JobProcessor {
    constructor() {
        this.scrapingService = new ScrapingService();
        this.isProcessing = false;
        this.processingInterval = null;
        this.processingIntervalMs = 5000; // Check every 5 seconds
    }

    start() {
        if (this.isProcessing) {
            console.log('Job processor is already running');
            return;
        }

        console.log('Starting job processor...');
        this.isProcessing = true;
        
        // Process immediately
        this.processJobs();
        
        // Set up interval for continuous processing
        this.processingInterval = setInterval(() => {
            this.processJobs();
        }, this.processingIntervalMs);
    }

    stop() {
        if (!this.isProcessing) {
            console.log('Job processor is not running');
            return;
        }

        console.log('Stopping job processor...');
        this.isProcessing = false;
        
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    async processJobs() {
        try {
            // Check if ScrapingOperation model is available
            if (!this.scrapingService || !this.scrapingService.getPendingOperations) {
                console.log('ScrapingService not ready, skipping job processing...');
                return;
            }

            const pendingOperations = await this.scrapingService.getPendingOperations();
            
            if (pendingOperations.length === 0) {
                return;
            }

            console.log(`Processing ${pendingOperations.length} pending operations...`);

            // Process operations in parallel (limit to 3 concurrent operations)
            const concurrentLimit = 3;
            const chunks = this.chunkArray(pendingOperations, concurrentLimit);

            for (const chunk of chunks) {
                const promises = chunk.map(operation => this.processOperation(operation));
                await Promise.allSettled(promises);
            }
        } catch (error) {
            console.error('Error processing jobs:', error);
            // Don't crash the processor, just log the error
        }
    }

    async processOperation(operation) {
        try {
            console.log(`Processing operation ${operation._id} for ${operation.seller} - ${operation.url}`);
            
            const result = await this.scrapingService.executeOperation(operation._id);
            
            console.log(`Operation ${operation._id} completed successfully. Products scraped: ${result.totalProducts}`);
            
            return result;
        } catch (error) {
            console.error(`Error processing operation ${operation._id}:`, error.message);
            
            // Update operation with error details
            try {
                await operation.markAsFailed(error.message, {
                    stack: error.stack,
                    name: error.name,
                    processedAt: new Date()
                });
            } catch (updateError) {
                console.error(`Error updating failed operation ${operation._id}:`, updateError);
            }
        }
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    async retryFailedOperations() {
        try {
            console.log('Retrying failed operations...');
            const results = await this.scrapingService.retryFailedOperations();
            console.log(`Retried ${results.length} operations`);
            return results;
        } catch (error) {
            console.error('Error retrying failed operations:', error);
            throw error;
        }
    }

    async cleanupOldOperations(daysOld = 30) {
        try {
            console.log(`Cleaning up operations older than ${daysOld} days...`);
            const deletedIds = await this.scrapingService.cleanupOldOperations(daysOld);
            console.log(`Cleaned up ${deletedIds.length} old operations`);
            return deletedIds;
        } catch (error) {
            console.error('Error cleaning up old operations:', error);
            throw error;
        }
    }

    async getStatus() {
        try {
            const stats = await this.scrapingService.getOperationStats();
            const sellerStats = await this.scrapingService.getSellerStats();
            const pendingCount = await ScrapingOperation.countDocuments({ status: 'pending' });
            const inProgressCount = await ScrapingOperation.countDocuments({ status: 'in_progress' });

            return {
                isProcessing: this.isProcessing,
                processingIntervalMs: this.processingIntervalMs,
                pendingOperations: pendingCount,
                inProgressOperations: inProgressCount,
                stats,
                sellerStats
            };
        } catch (error) {
            console.error('Error getting processor status:', error);
            throw error;
        }
    }

    // Method to manually trigger processing
    async triggerProcessing() {
        if (!this.isProcessing) {
            throw new Error('Job processor is not running');
        }
        
        await this.processJobs();
    }

    // Method to change processing interval
    setProcessingInterval(intervalMs) {
        if (intervalMs < 1000) {
            throw new Error('Processing interval must be at least 1000ms');
        }
        
        this.processingIntervalMs = intervalMs;
        
        if (this.isProcessing) {
            // Restart with new interval
            this.stop();
            this.start();
        }
    }
}

// Create singleton instance
const jobProcessor = new JobProcessor();

// Auto-start the processor after a short delay to ensure models are loaded
setTimeout(() => {
    jobProcessor.start();
}, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down job processor...');
    jobProcessor.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down job processor...');
    jobProcessor.stop();
    process.exit(0);
});

module.exports = jobProcessor;
