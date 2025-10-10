const axios = require('axios');

// Test the enhanced scrape-logs API
async function testEnhancedScrapeLogsAPI() {
    const baseURL = 'http://localhost:3000/api';
    
    console.log('🧪 Testing Enhanced Scrape Logs API...\n');
    
    try {
        // Test 1: Get scrape logs with enhanced details
        console.log('1. Testing GET /api/scrape-logs with enhanced details...');
        const response1 = await axios.get(`${baseURL}/scrape-logs?page=1&limit=5&includeDetails=true`);
        
        if (response1.data.success) {
            console.log('✅ Enhanced scrape logs retrieved successfully');
            console.log(`   Total items: ${response1.data.pagination.totalItems}`);
            console.log(`   Items per page: ${response1.data.pagination.itemsPerPage}`);
            
            if (response1.data.data.length > 0) {
                const firstItem = response1.data.data[0];
                console.log('   Sample item with enhanced details:');
                console.log(`   - Platform: ${firstItem.platform}`);
                console.log(`   - Type: ${firstItem.type}`);
                console.log(`   - Status: ${firstItem.status}`);
                console.log(`   - Total Products: ${firstItem.totalProducts || 0}`);
                console.log(`   - Scraped Products: ${firstItem.scrapedProducts || 0}`);
                console.log(`   - Failed Products: ${firstItem.failedProducts || 0}`);
                console.log(`   - Duration: ${firstItem.duration || 0}ms`);
                console.log(`   - Progress: ${firstItem.progress?.percentage || 0}%`);
            }
        } else {
            console.log('❌ Failed to retrieve enhanced scrape logs');
        }
        
        console.log('\n');
        
        // Test 2: Get comprehensive statistics
        console.log('2. Testing GET /api/scrape-logs/stats/comprehensive...');
        const response2 = await axios.get(`${baseURL}/scrape-logs/stats/comprehensive`);
        
        if (response2.data.success) {
            console.log('✅ Comprehensive statistics retrieved successfully');
            const stats = response2.data.data;
            console.log('   Overall Statistics:');
            console.log(`   - Total Operations: ${stats.overall.totalOperations}`);
            console.log(`   - Total Products: ${stats.overall.totalProducts}`);
            console.log(`   - Total Scraped Products: ${stats.overall.totalScrapedProducts}`);
            console.log(`   - Total Failed Products: ${stats.overall.totalFailedProducts}`);
            console.log(`   - Success Rate: ${stats.overall.successRate}%`);
            console.log(`   - Product Success Rate: ${stats.overall.productSuccessRate}%`);
            console.log(`   - Average Duration: ${Math.round(stats.overall.avgDuration || 0)}ms`);
            
            if (stats.byPlatform && stats.byPlatform.length > 0) {
                console.log('   Platform-wise Statistics:');
                stats.byPlatform.forEach(platform => {
                    console.log(`   - ${platform._id}: ${platform.totalOperations} ops, ${platform.successRate}% success rate`);
                });
            }
        } else {
            console.log('❌ Failed to retrieve comprehensive statistics');
        }
        
        console.log('\n');
        
        // Test 3: Get basic statistics (existing endpoint)
        console.log('3. Testing GET /api/scrape-logs/stats...');
        const response3 = await axios.get(`${baseURL}/scrape-logs/stats`);
        
        if (response3.data.success) {
            console.log('✅ Basic statistics retrieved successfully');
            const stats = response3.data.data;
            console.log('   Status Counts:');
            console.log(`   - Success: ${stats.counts.success}`);
            console.log(`   - Failed: ${stats.counts.failed}`);
            console.log(`   - Pending: ${stats.counts.pending}`);
            console.log(`   - In Progress: ${stats.counts.in_progress}`);
            console.log(`   - Cancelled: ${stats.counts.cancelled}`);
            console.log(`   - Overall Success Rate: ${stats.successRate}%`);
        } else {
            console.log('❌ Failed to retrieve basic statistics');
        }
        
        console.log('\n');
        
        // Test 4: Test detailed report for a specific log (if any exist)
        if (response1.data.data.length > 0) {
            const logId = response1.data.data[0]._id;
            console.log(`4. Testing GET /api/scrape-logs/${logId}/report...`);
            const response4 = await axios.get(`${baseURL}/scrape-logs/${logId}/report`);
            
            if (response4.data.success) {
                console.log('✅ Detailed report retrieved successfully');
                const report = response4.data.data;
                console.log('   Report Summary:');
                console.log(`   - Platform: ${report.logDetails.platform}`);
                console.log(`   - Type: ${report.logDetails.type}`);
                console.log(`   - Status: ${report.logDetails.status}`);
                console.log(`   - Total Products: ${report.summary.totalProducts}`);
                console.log(`   - Scraped Products: ${report.summary.scrapedProducts}`);
                console.log(`   - Failed Products: ${report.summary.failedProducts}`);
                console.log(`   - Success Rate: ${report.summary.successRate}%`);
                console.log(`   - Duration: ${report.summary.duration}ms`);
                
                if (report.operationDetails) {
                    console.log('   Operation Details Available: ✅');
                } else {
                    console.log('   Operation Details: Not linked to operation');
                }
            } else {
                console.log('❌ Failed to retrieve detailed report');
            }
        }
        
        console.log('\n');
        
        // Test 5: Test filtering capabilities
        console.log('5. Testing filtering capabilities...');
        const response5 = await axios.get(`${baseURL}/scrape-logs?platform=flipkart&status=success&limit=3`);
        
        if (response5.data.success) {
            console.log('✅ Filtering works correctly');
            console.log(`   Filtered results: ${response5.data.data.length} items`);
            if (response5.data.data.length > 0) {
                console.log(`   All items are from Flipkart: ${response5.data.data.every(item => item.platform === 'flipkart')}`);
                console.log(`   All items are successful: ${response5.data.data.every(item => item.status === 'success')}`);
            }
        } else {
            console.log('❌ Filtering failed');
        }
        
        console.log('\n🎉 All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    }
}

// Run the test
if (require.main === module) {
    testEnhancedScrapeLogsAPI();
}

module.exports = testEnhancedScrapeLogsAPI;



