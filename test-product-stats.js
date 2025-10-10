const axios = require('axios');

// Test the enhanced product statistics in scrape logs API
async function testProductStats() {
    const baseURL = 'http://localhost:3333/api';
    
    console.log('🧪 Testing Enhanced Product Statistics...\n');
    
    try {
        // Test 1: Get scrape logs with enhanced product statistics
        console.log('1. Testing GET /api/scrape-logs with product statistics...');
        const response = await axios.get(`${baseURL}/scrape-logs?page=1&limit=3&includeDetails=true`);
        
        if (response.data.success) {
            console.log('✅ Enhanced scrape logs with product statistics retrieved successfully');
            console.log(`   Total items: ${response.data.pagination.totalItems}`);
            
            if (response.data.data.length > 0) {
                console.log('\n   Sample log entries with product statistics:');
                response.data.data.forEach((item, index) => {
                    console.log(`\n   Entry ${index + 1}:`);
                    console.log(`   - Platform: ${item.platform}`);
                    console.log(`   - Type: ${item.type}`);
                    console.log(`   - Status: ${item.status}`);
                    console.log(`   - URL: ${item.url.substring(0, 60)}...`);
                    
                    console.log(`   📊 Product Statistics:`);
                    console.log(`   - Total Products: ${item.productStats.total}`);
                    console.log(`   - Successfully Scraped: ${item.productStats.successful}`);
                    console.log(`   - Failed Products: ${item.productStats.failed}`);
                    console.log(`   - Remaining: ${item.productStats.remaining}`);
                    console.log(`   - Success Rate: ${item.productStats.successRate}%`);
                    
                    console.log(`   ⏱️  Performance:`);
                    console.log(`   - Duration: ${item.duration}ms`);
                    console.log(`   - Progress: ${item.progress?.percentage || 0}%`);
                    
                    if (item.errorMessage) {
                        console.log(`   ❌ Error: ${item.errorMessage}`);
                    }
                });
            } else {
                console.log('   No log entries found');
            }
        } else {
            console.log('❌ Failed to retrieve enhanced scrape logs');
        }
        
        console.log('\n');
        
        // Test 2: Get detailed report for a specific log (if any exist)
        if (response.data.data.length > 0) {
            const logId = response.data.data[0]._id;
            console.log(`2. Testing GET /api/scrape-logs/${logId}/report...`);
            const reportResponse = await axios.get(`${baseURL}/scrape-logs/${logId}/report`);
            
            if (reportResponse.data.success) {
                console.log('✅ Detailed report retrieved successfully');
                const report = reportResponse.data.data;
                
                console.log('   📋 Report Summary:');
                console.log(`   - Platform: ${report.logDetails.platform}`);
                console.log(`   - Type: ${report.logDetails.type}`);
                console.log(`   - Status: ${report.logDetails.status}`);
                console.log(`   - Action: ${report.logDetails.action}`);
                
                console.log('   📊 Product Statistics Summary:');
                console.log(`   - Total Products: ${report.summary.productStats.total}`);
                console.log(`   - Successfully Scraped: ${report.summary.productStats.successful}`);
                console.log(`   - Failed Products: ${report.summary.productStats.failed}`);
                console.log(`   - Remaining: ${report.summary.productStats.remaining}`);
                console.log(`   - Success Rate: ${report.summary.productStats.successRate}%`);
                
                console.log('   ⏱️  Performance Summary:');
                console.log(`   - Duration: ${report.summary.duration}ms`);
                console.log(`   - Progress: ${report.summary.progress.percentage}%`);
                
                if (report.operationDetails) {
                    console.log('   🔗 Operation Details Available:');
                    console.log(`   - Seller: ${report.operationDetails.seller}`);
                    console.log(`   - Retry Count: ${report.operationDetails.retryCount}`);
                    if (report.operationDetails.errorMessage) {
                        console.log(`   - Error: ${report.operationDetails.errorMessage}`);
                    }
                }
            } else {
                console.log('❌ Failed to retrieve detailed report');
            }
        }
        
        console.log('\n');
        
        // Test 3: Test filtering by successful operations
        console.log('3. Testing filtering for successful operations...');
        const successResponse = await axios.get(`${baseURL}/scrape-logs?status=success&limit=2&includeDetails=true`);
        
        if (successResponse.data.success) {
            console.log('✅ Successfully filtered operations retrieved');
            console.log(`   Found ${successResponse.data.data.length} successful operations`);
            
            if (successResponse.data.data.length > 0) {
                const totalSuccessful = successResponse.data.data.reduce((sum, item) => sum + item.productStats.successful, 0);
                const totalFailed = successResponse.data.data.reduce((sum, item) => sum + item.productStats.failed, 0);
                const totalProducts = successResponse.data.data.reduce((sum, item) => sum + item.productStats.total, 0);
                
                console.log('   📊 Aggregated Statistics:');
                console.log(`   - Total Products: ${totalProducts}`);
                console.log(`   - Successfully Scraped: ${totalSuccessful}`);
                console.log(`   - Failed Products: ${totalFailed}`);
                console.log(`   - Overall Success Rate: ${totalProducts > 0 ? Math.round((totalSuccessful / totalProducts) * 10000) / 100 : 0}%`);
            }
        } else {
            console.log('❌ Failed to filter successful operations');
        }
        
        console.log('\n🎉 Product statistics testing completed!');
        
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
    testProductStats();
}

module.exports = testProductStats;
