var express = require('express');
var router = express.Router();
const Joi = require('joi');
const ScrapeLog = require('../models/scrapeLog.model');
const ScrapingOperation = require('../models/scrapingOperation.model');
const mongoose = require('mongoose');

const createSchema = Joi.object({
	when: Joi.date().optional(),
	platform: Joi.string().required(),
	type: Joi.string().valid('product', 'category').required(),
	url: Joi.string().uri().required(),
	category: Joi.string().allow('').optional(),
	status: Joi.string().valid('pending','in_progress','success','failed','cancelled').required(),
	action: Joi.string().allow('').optional(),
	operationId: Joi.string().optional()
});

const updateSchema = Joi.object({
	when: Joi.date().optional(),
	platform: Joi.string().optional(),
	type: Joi.string().valid('product', 'category').optional(),
	url: Joi.string().uri().optional(),
	category: Joi.string().allow('').optional(),
	status: Joi.string().valid('pending','in_progress','success','failed','cancelled').optional(),
	action: Joi.string().allow('').optional(),
	operationId: Joi.string().optional()
}).min(1);

// Create a new scrape log
router.post('/', async (req, res) => {
	try {
		const { error, value } = createSchema.validate(req.body);
		if (error) {
			return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
		}

		const log = new ScrapeLog(value);
		await log.save();
		return res.status(201).json({ success: true, message: 'Scrape log created', data: log });
	} catch (err) {
		console.error('Error creating scrape log:', err);
		return res.status(500).json({ success: false, message: 'Failed to create scrape log', error: err.message });
	}
});

// Get scrape logs with filters and pagination
router.get('/', async (req, res) => {
	try {
		const { page = 1, limit = 20, platform, type, status, category, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc', includeDetails = 'true' } = req.query;

		const filter = {};
		if (platform) filter.platform = platform;
		if (type) filter.type = type;
		if (status) filter.status = status;
		if (category) filter.category = new RegExp(category, 'i');
		if (startDate || endDate) {
			filter.when = {};
			if (startDate) filter.when.$gte = new Date(startDate);
			if (endDate) filter.when.$lte = new Date(endDate);
		}
		if (search) {
			filter.$or = [
				{ url: new RegExp(search, 'i') },
				{ platform: new RegExp(search, 'i') },
				{ action: new RegExp(search, 'i') }
			];
		}

		const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build aggregation pipeline
		const pipeline = [
			{ $match: filter },
			{ $sort: sort },
			{ $skip: skip },
			{ $limit: parseInt(limit) }
		];

		// Add lookup for operation details if requested
		if (includeDetails === 'true') {
			pipeline.push({
				$lookup: {
					from: 'scraping_operations',
					localField: 'operationId',
					foreignField: '_id',
					as: 'operationDetails'
				}
			});
			pipeline.push({
				$addFields: {
					operationDetails: { $arrayElemAt: ['$operationDetails', 0] }
				}
			});
		}

		const [items, total] = await Promise.all([
			ScrapeLog.aggregate(pipeline),
			ScrapeLog.countDocuments(filter)
		]);

		// Add summary statistics for each log entry
		const enhancedItems = items.map(item => {
			const enhanced = { ...item };
			
			if (item.operationDetails) {
				enhanced.totalProducts = item.operationDetails.totalProducts || 0;
				enhanced.scrapedProducts = item.operationDetails.scrapedProducts || 0;
				enhanced.failedProducts = item.operationDetails.failedProducts || 0;
				enhanced.duration = item.operationDetails.duration || 0;
				enhanced.progress = item.operationDetails.progress || { current: 0, total: 0, percentage: 0 };
				enhanced.errorMessage = item.operationDetails.errorMessage || null;
				enhanced.retryCount = item.operationDetails.retryCount || 0;
				
				// Calculate success rate for products
				const totalProducts = enhanced.totalProducts || 0;
				const scrapedProducts = enhanced.scrapedProducts || 0;
				enhanced.productSuccessRate = totalProducts > 0 ? 
					Math.round((scrapedProducts / totalProducts) * 10000) / 100 : 0;
				
				// Add product statistics summary
				enhanced.productStats = {
					total: totalProducts,
					successful: scrapedProducts,
					failed: enhanced.failedProducts || 0,
					successRate: enhanced.productSuccessRate,
					remaining: Math.max(0, totalProducts - scrapedProducts - (enhanced.failedProducts || 0))
				};
			} else {
				enhanced.totalProducts = 0;
				enhanced.scrapedProducts = 0;
				enhanced.failedProducts = 0;
				enhanced.duration = 0;
				enhanced.progress = { current: 0, total: 0, percentage: 0 };
				enhanced.errorMessage = null;
				enhanced.retryCount = 0;
				enhanced.productSuccessRate = 0;
				enhanced.productStats = {
					total: 0,
					successful: 0,
					failed: 0,
					successRate: 0,
					remaining: 0
				};
			}

			return enhanced;
		});

		return res.json({ 
			success: true, 
			data: enhancedItems, 
			pagination: { 
				currentPage: parseInt(page), 
				totalPages: Math.ceil(total / parseInt(limit)), 
				totalItems: total, 
				itemsPerPage: parseInt(limit) 
			} 
		});
	} catch (err) {
		console.error('Error fetching scrape logs:', err);
		return res.status(500).json({ success: false, message: 'Failed to fetch scrape logs', error: err.message });
	}
});

// Update a scrape log
router.put('/:id', async (req, res) => {
	try {
		const { error, value } = updateSchema.validate(req.body);
		if (error) {
			return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
		}

		const updated = await ScrapeLog.findByIdAndUpdate(req.params.id, { $set: value }, { new: true });
		if (!updated) return res.status(404).json({ success: false, message: 'Scrape log not found' });
		return res.json({ success: true, message: 'Scrape log updated', data: updated });
	} catch (err) {
		console.error('Error updating scrape log:', err);
		return res.status(500).json({ success: false, message: 'Failed to update scrape log', error: err.message });
	}
});

// Partially update a scrape log (PATCH)
router.patch('/:id', async (req, res) => {
    try {
        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
        }

        const updated = await ScrapeLog.findByIdAndUpdate(req.params.id, { $set: value }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Scrape log not found' });
        return res.json({ success: true, message: 'Scrape log updated', data: updated });
    } catch (err) {
        console.error('Error patching scrape log:', err);
        return res.status(500).json({ success: false, message: 'Failed to patch scrape log', error: err.message });
    }
});

// Get detailed report for a specific scrape log
router.get('/:id/report', async (req, res) => {
	try {
		const logId = req.params.id;
		
		const log = await ScrapeLog.findById(logId).populate('operationId');
		
		if (!log) {
			return res.status(404).json({ success: false, message: 'Scrape log not found' });
		}

		const report = {
			logDetails: {
				_id: log._id,
				when: log.when,
				platform: log.platform,
				type: log.type,
				url: log.url,
				category: log.category,
				status: log.status,
				action: log.action,
				createdAt: log.createdAt,
				updatedAt: log.updatedAt
			},
			operationDetails: null,
			summary: {
				totalProducts: 0,
				scrapedProducts: 0,
				failedProducts: 0,
				successRate: 0,
				duration: 0,
				progress: { current: 0, total: 0, percentage: 0 },
				productStats: {
					total: 0,
					successful: 0,
					failed: 0,
					successRate: 0,
					remaining: 0
				}
			}
		};

		if (log.operationId) {
			report.operationDetails = {
				_id: log.operationId._id,
				seller: log.operationId.seller,
				attemptTime: log.operationId.attemptTime,
				startTime: log.operationId.startTime,
				endTime: log.operationId.endTime,
				duration: log.operationId.duration,
				totalProducts: log.operationId.totalProducts,
				scrapedProducts: log.operationId.scrapedProducts,
				failedProducts: log.operationId.failedProducts,
				errorMessage: log.operationId.errorMessage,
				errorDetails: log.operationId.errorDetails,
				retryCount: log.operationId.retryCount,
				maxRetries: log.operationId.maxRetries,
				config: log.operationId.config,
				progress: log.operationId.progress,
				notes: log.operationId.notes,
				tags: log.operationId.tags
			};

			const totalProducts = log.operationId.totalProducts || 0;
			const scrapedProducts = log.operationId.scrapedProducts || 0;
			const failedProducts = log.operationId.failedProducts || 0;
			const successRate = totalProducts > 0 ? 
				Math.round((scrapedProducts / totalProducts) * 10000) / 100 : 0;

			report.summary = {
				totalProducts: totalProducts,
				scrapedProducts: scrapedProducts,
				failedProducts: failedProducts,
				successRate: successRate,
				duration: log.operationId.duration || 0,
				progress: log.operationId.progress || { current: 0, total: 0, percentage: 0 },
				productStats: {
					total: totalProducts,
					successful: scrapedProducts,
					failed: failedProducts,
					successRate: successRate,
					remaining: Math.max(0, totalProducts - scrapedProducts - failedProducts)
				}
			};
		}

		return res.json({ success: true, data: report });
	} catch (err) {
		console.error('Error generating detailed report:', err);
		return res.status(500).json({ success: false, message: 'Failed to generate detailed report', error: err.message });
	}
});

// Get comprehensive statistics with product counts
router.get('/stats/comprehensive', async (req, res) => {
	try {
		const { startDate, endDate, platform, type } = req.query;

		const match = {};
		if (platform) match.platform = platform;
		if (type) match.type = type;
		if (startDate || endDate) {
			match.when = {};
			if (startDate) match.when.$gte = new Date(startDate);
			if (endDate) match.when.$lte = new Date(endDate);
		}

		// Enhanced aggregation with operation details
		const comprehensiveStats = await ScrapeLog.aggregate([
			{ $match: match },
			{
				$lookup: {
					from: 'scraping_operations',
					localField: 'operationId',
					foreignField: '_id',
					as: 'operation'
				}
			},
			{
				$addFields: {
					operation: { $arrayElemAt: ['$operation', 0] }
				}
			},
			{
				$group: {
					_id: {
						status: '$status',
						platform: '$platform',
						type: '$type'
					},
					count: { $sum: 1 },
					totalProducts: { $sum: { $ifNull: ['$operation.totalProducts', 0] } },
					scrapedProducts: { $sum: { $ifNull: ['$operation.scrapedProducts', 0] } },
					failedProducts: { $sum: { $ifNull: ['$operation.failedProducts', 0] } },
					avgDuration: { $avg: { $ifNull: ['$operation.duration', 0] } },
					totalDuration: { $sum: { $ifNull: ['$operation.duration', 0] } }
				}
			}
		]);

		// Overall statistics
		const overallStats = await ScrapeLog.aggregate([
			{ $match: match },
			{
				$lookup: {
					from: 'scraping_operations',
					localField: 'operationId',
					foreignField: '_id',
					as: 'operation'
				}
			},
			{
				$addFields: {
					operation: { $arrayElemAt: ['$operation', 0] }
				}
			},
			{
				$group: {
					_id: null,
					totalOperations: { $sum: 1 },
					totalProducts: { $sum: { $ifNull: ['$operation.totalProducts', 0] } },
					totalScrapedProducts: { $sum: { $ifNull: ['$operation.scrapedProducts', 0] } },
					totalFailedProducts: { $sum: { $ifNull: ['$operation.failedProducts', 0] } },
					avgDuration: { $avg: { $ifNull: ['$operation.duration', 0] } },
					successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
					failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
					pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
					inProgressCount: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
					cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
				}
			}
		]);

		const overall = overallStats[0] || {
			totalOperations: 0,
			totalProducts: 0,
			totalScrapedProducts: 0,
			totalFailedProducts: 0,
			avgDuration: 0,
			successCount: 0,
			failedCount: 0,
			pendingCount: 0,
			inProgressCount: 0,
			cancelledCount: 0
		};

		const successRate = overall.totalOperations > 0 ? 
			Math.round((overall.successCount / overall.totalOperations) * 10000) / 100 : 0;
		
		const productSuccessRate = overall.totalProducts > 0 ? 
			Math.round((overall.totalScrapedProducts / overall.totalProducts) * 10000) / 100 : 0;

		// Platform-wise statistics
		const platformStats = await ScrapeLog.aggregate([
			{ $match: match },
			{
				$lookup: {
					from: 'scraping_operations',
					localField: 'operationId',
					foreignField: '_id',
					as: 'operation'
				}
			},
			{
				$addFields: {
					operation: { $arrayElemAt: ['$operation', 0] }
				}
			},
			{
				$group: {
					_id: '$platform',
					totalOperations: { $sum: 1 },
					successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
					failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
					totalProducts: { $sum: { $ifNull: ['$operation.totalProducts', 0] } },
					scrapedProducts: { $sum: { $ifNull: ['$operation.scrapedProducts', 0] } },
					failedProducts: { $sum: { $ifNull: ['$operation.failedProducts', 0] } },
					avgDuration: { $avg: { $ifNull: ['$operation.duration', 0] } }
				}
			},
			{
				$addFields: {
					successRate: {
						$round: [
							{ $multiply: [{ $divide: ['$successCount', '$totalOperations'] }, 100] },
							2
						]
					},
					productSuccessRate: {
						$round: [
							{ $multiply: [{ $divide: ['$scrapedProducts', { $max: ['$totalProducts', 1] }] }, 100] },
							2
						]
					}
				}
			}
		]);

		return res.json({
			success: true,
			data: {
				overall: {
					...overall,
					successRate,
					productSuccessRate
				},
				byPlatform: platformStats,
				detailed: comprehensiveStats,
				generatedAt: new Date().toISOString()
			}
		});
	} catch (err) {
		console.error('Error generating comprehensive stats:', err);
		return res.status(500).json({ success: false, message: 'Failed to generate comprehensive stats', error: err.message });
	}
});

// Dashboard stats: status counts, success rate, and chart-ready time series
router.get('/stats', async (req, res) => {
	try {
		const { startDate, endDate, platform } = req.query;

		const match = {};
		if (platform) match.platform = platform;
		if (startDate || endDate) {
			match.when = {};
			if (startDate) match.when.$gte = new Date(startDate);
			if (endDate) match.when.$lte = new Date(endDate);
		}

		// Status counts and success rate
		const statusAgg = await ScrapeLog.aggregate([
			{ $match: match },
			{ $group: { _id: "$status", count: { $sum: 1 } } }
		]);

		const counts = statusAgg.reduce((acc, cur) => {
			acc[cur._id] = cur.count; return acc;
		}, { pending: 0, in_progress: 0, success: 0, failed: 0, cancelled: 0 });

		const total = Object.values(counts).reduce((a, b) => a + b, 0);
		const successRate = total ? Math.round(((counts.success || 0) / total) * 10000) / 100 : 0;

		// Chart series by day: total and by status
		const seriesAgg = await ScrapeLog.aggregate([
			{ $match: match },
			{ $group: {
				_id: {
					year: { $year: "$when" },
					month: { $month: "$when" },
					day: { $dayOfMonth: "$when" }
				},
				total: { $sum: 1 },
				success: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
				failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
				pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
				in_progress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
				cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } }
			} },
			{ $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
		]);

		const chart = seriesAgg.map(pt => ({
			date: new Date(pt._id.year, pt._id.month - 1, pt._id.day).toISOString().slice(0, 10),
			total: pt.total,
			success: pt.success,
			failed: pt.failed,
			pending: pt.pending,
			in_progress: pt.in_progress,
			cancelled: pt.cancelled
		}));

		return res.json({
			success: true,
			data: {
				counts,
				total,
				successRate,
				chart
			}
		});
	} catch (err) {
		console.error('Error generating scrape logs stats:', err);
		return res.status(500).json({ success: false, message: 'Failed to generate stats', error: err.message });
	}
});

module.exports = router;
