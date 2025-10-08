const express = require('express');
const router = express.Router();
const jobProcessor = require('../utilities/jobProcessor');

// GET /api/job-processor/status - Get processor status
router.get('/status', async (req, res) => {
    try {
        const status = await jobProcessor.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting processor status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get processor status',
            error: error.message
        });
    }
});

// POST /api/job-processor/start - Start the processor
router.post('/start', (req, res) => {
    try {
        jobProcessor.start();
        res.json({
            success: true,
            message: 'Job processor started successfully'
        });
    } catch (error) {
        console.error('Error starting processor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start processor',
            error: error.message
        });
    }
});

// POST /api/job-processor/stop - Stop the processor
router.post('/stop', (req, res) => {
    try {
        jobProcessor.stop();
        res.json({
            success: true,
            message: 'Job processor stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping processor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop processor',
            error: error.message
        });
    }
});

// POST /api/job-processor/trigger - Manually trigger processing
router.post('/trigger', async (req, res) => {
    try {
        await jobProcessor.triggerProcessing();
        res.json({
            success: true,
            message: 'Processing triggered successfully'
        });
    } catch (error) {
        console.error('Error triggering processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger processing',
            error: error.message
        });
    }
});

// POST /api/job-processor/retry-failed - Retry failed operations
router.post('/retry-failed', async (req, res) => {
    try {
        const results = await jobProcessor.retryFailedOperations();
        res.json({
            success: true,
            message: `Retried ${results.length} failed operations`,
            data: results
        });
    } catch (error) {
        console.error('Error retrying failed operations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retry failed operations',
            error: error.message
        });
    }
});

// POST /api/job-processor/cleanup - Cleanup old operations
router.post('/cleanup', async (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        const deletedIds = await jobProcessor.cleanupOldOperations(daysOld);
        res.json({
            success: true,
            message: `Cleaned up ${deletedIds.length} old operations`,
            data: deletedIds
        });
    } catch (error) {
        console.error('Error cleaning up operations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup operations',
            error: error.message
        });
    }
});

// PUT /api/job-processor/interval - Update processing interval
router.put('/interval', (req, res) => {
    try {
        const { intervalMs } = req.body;
        
        if (!intervalMs || intervalMs < 1000) {
            return res.status(400).json({
                success: false,
                message: 'Interval must be at least 1000ms'
            });
        }
        
        jobProcessor.setProcessingInterval(intervalMs);
        res.json({
            success: true,
            message: `Processing interval updated to ${intervalMs}ms`
        });
    } catch (error) {
        console.error('Error updating interval:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update interval',
            error: error.message
        });
    }
});

module.exports = router;
