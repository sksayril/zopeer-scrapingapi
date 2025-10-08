var express = require('express');
var router = express.Router();
const Joi = require('joi');
const ScrapeLog = require('../models/scrapeLog.model');
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
		const { page = 1, limit = 20, platform, type, status, category, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

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

		const [items, total] = await Promise.all([
			ScrapeLog.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
			ScrapeLog.countDocuments(filter)
		]);

		return res.json({ success: true, data: items, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalItems: total, itemsPerPage: parseInt(limit) } });
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

module.exports = router;

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
