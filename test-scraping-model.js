const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.DATABASE_URL);
mongoose.connection
  .on("open", () => console.log("Database connected!"))
  .on("error", (error) => {
    console.log(`Connection failed: ${error}`);
  });

// Import the model
const ScrapingOperation = require('./models/scrapingOperation.model');

async function testModel() {
    try {
        console.log('Testing ScrapingOperation model...');
        
        // Test if model is properly loaded
        if (!ScrapingOperation) {
            throw new Error('ScrapingOperation model is not loaded');
        }
        
        if (typeof ScrapingOperation.find !== 'function') {
            throw new Error('ScrapingOperation.find is not a function');
        }
        
        console.log('✓ Model is properly loaded');
        
        // Test basic operations
        const count = await ScrapingOperation.countDocuments();
        console.log(`✓ Found ${count} existing operations`);
        
        // Test creating a new operation
        const testOperation = new ScrapingOperation({
            url: 'https://test.com',
            seller: 'amazon',
            type: 'product',
            category: 'Test Category'
        });
        
        await testOperation.save();
        console.log('✓ Successfully created test operation');
        
        // Test finding operations
        const operations = await ScrapingOperation.find({ seller: 'amazon' });
        console.log(`✓ Found ${operations.length} operations for amazon`);
        
        // Clean up test operation
        await ScrapingOperation.findByIdAndDelete(testOperation._id);
        console.log('✓ Cleaned up test operation');
        
        console.log('All tests passed! Model is working correctly.');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        mongoose.connection.close();
    }
}

testModel();
