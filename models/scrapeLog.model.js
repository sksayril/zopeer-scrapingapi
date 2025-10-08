const mongoose = require('mongoose');

const scrapeLogSchema = new mongoose.Schema({
	when: {
		type: Date,
		default: Date.now,
		index: true
	},
	platform: {
		type: String,
		required: true,
		trim: true
	},
	type: {
		type: String,
		required: true,
		enum: ['product', 'category']
	},
	url: {
		type: String,
		required: true,
		trim: true
	},
	category: {
		type: String,
		trim: true
	},
	status: {
		type: String,
		required: true,
		enum: ['pending', 'in_progress', 'success', 'failed', 'cancelled']
	},
	action: {
		type: String,
		trim: true,
		default: ''
	},
	// Optional linkage to detailed operation
	operationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ScrapingOperation'
	}
}, {
	timestamps: true,
	collection: 'scrape_logs'
});

scrapeLogSchema.index({ platform: 1, status: 1, when: -1 });
scrapeLogSchema.index({ url: 1 });

module.exports = mongoose.model('ScrapeLog', scrapeLogSchema);
