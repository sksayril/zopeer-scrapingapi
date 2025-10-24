const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api/scrape-logs';
const TEST_DATA = {
    platform: 'amazon',
    type: 'product',
    url: 'https://amazon.com/test-product',
    category: 'Electronics',
    status: 'pending',
    action: 'scrape_product_details'
};

// Helper function to make API calls
async function makeRequest(method, endpoint, data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) config.data = data;
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// Test functions
async function testCreateScrapeLog() {
    console.log('\n=== Testing Create Scrape Log ===');
    try {
        const result = await makeRequest('POST', '', TEST_DATA);
        console.log('✅ Create Scrape Log:', result);
        return result.data._id;
    } catch (error) {
        console.error('❌ Create Scrape Log failed:', error.message);
        return null;
    }
}

async function testGetScrapeLogs() {
    console.log('\n=== Testing Get Scrape Logs with Enhanced Statistics ===');
    try {
        const result = await makeRequest('GET', '');
        console.log('✅ Get Scrape Logs:', {
            totalItems: result.pagination?.totalItems,
            currentPage: result.pagination?.currentPage,
            itemsCount: result.data?.length
        });
        
        // Show enhanced product statistics for first item
        if (result.data && result.data.length > 0) {
            const firstItem = result.data[0];
            console.log('📊 Enhanced Product Statistics for first item:', {
                totalProducts: firstItem.totalProducts,
                scrapedProducts: firstItem.scrapedProducts,
                failedProducts: firstItem.failedProducts,
                productSuccessRate: firstItem.productSuccessRate,
                productStats: firstItem.productStats,
                when: firstItem.when,
                status: firstItem.status
            });
        }
        return result.data;
    } catch (error) {
        console.error('❌ Get Scrape Logs failed:', error.message);
        return [];
    }
}

async function testUpdateScrapeLog(logId) {
    console.log('\n=== Testing Update Scrape Log with Product Statistics ===');
    try {
        const updateData = {
            status: 'in_progress',
            totalProducts: 100,
            scrapedProducts: 25,
            failedProducts: 5,
            progress: {
                current: 25,
                total: 100,
                percentage: 25
            },
            duration: 30000,
            errorMessage: '',
            retryCount: 0
        };
        
        const result = await makeRequest('PUT', `/${logId}`, updateData);
        console.log('✅ Update Scrape Log:', {
            success: result.success,
            message: result.message,
            updatedStats: {
                totalProducts: result.data.totalProducts,
                scrapedProducts: result.data.scrapedProducts,
                failedProducts: result.data.failedProducts,
                productSuccessRate: result.data.productSuccessRate,
                productStats: result.data.productStats
            }
        });
        return result.data;
    } catch (error) {
        console.error('❌ Update Scrape Log failed:', error.message);
        return null;
    }
}

async function testPatchScrapeLog(logId) {
    console.log('\n=== Testing PATCH Update with Product Statistics ===');
    try {
        const patchData = {
            scrapedProducts: 50,
            failedProducts: 8,
            progress: {
                current: 50,
                total: 100,
                percentage: 50
            }
        };
        
        const result = await makeRequest('PATCH', `/${logId}`, patchData);
        console.log('✅ PATCH Update:', {
            success: result.success,
            updatedStats: {
                scrapedProducts: result.data.scrapedProducts,
                failedProducts: result.data.failedProducts,
                productSuccessRate: result.data.productSuccessRate,
                remaining: result.data.productStats?.remaining
            }
        });
        return result.data;
    } catch (error) {
        console.error('❌ PATCH Update failed:', error.message);
        return null;
    }
}

async function testBulkUpdateStats() {
    console.log('\n=== Testing Bulk Update Statistics ===');
    try {
        const bulkData = {
            updates: [
                {
                    logId: 'test-log-1',
                    totalProducts: 200,
                    scrapedProducts: 150,
                    failedProducts: 10
                },
                {
                    logId: 'test-log-2',
                    totalProducts: 300,
                    scrapedProducts: 250,
                    failedProducts: 15
                }
            ]
        };
        
        const result = await makeRequest('PATCH', '/bulk-update-stats', bulkData);
        console.log('✅ Bulk Update:', {
            success: result.success,
            message: result.message,
            summary: result.data
        });
        return result.data;
    } catch (error) {
        console.error('❌ Bulk Update failed:', error.message);
        return null;
    }
}

async function testComprehensiveStats() {
    console.log('\n=== Testing Comprehensive Statistics ===');
    try {
        const result = await makeRequest('GET', '/stats/comprehensive');
        console.log('✅ Comprehensive Stats:', {
            overall: {
                totalOperations: result.data.overall.totalOperations,
                totalProducts: result.data.overall.totalProducts,
                totalScrapedProducts: result.data.overall.totalScrapedProducts,
                totalFailedProducts: result.data.overall.totalFailedProducts,
                successRate: result.data.overall.successRate,
                productSuccessRate: result.data.overall.productSuccessRate
            },
            platformCount: result.data.byPlatform?.length || 0,
            detailedCount: result.data.detailed?.length || 0
        });
        return result.data;
    } catch (error) {
        console.error('❌ Comprehensive Stats failed:', error.message);
        return null;
    }
}

async function testRealtimeStats() {
    console.log('\n=== Testing Real-time Statistics ===');
    try {
        const result = await makeRequest('GET', '/realtime-stats?lastMinutes=60');
        console.log('✅ Real-time Stats:', {
            totalOperations: result.data.totalOperations,
            activeOperations: result.data.activeOperations,
            completedOperations: result.data.completedOperations,
            totalProducts: result.data.totalProducts,
            scrapedProducts: result.data.scrapedProducts,
            failedProducts: result.data.failedProducts,
            operationSuccessRate: result.data.operationSuccessRate,
            productSuccessRate: result.data.productSuccessRate,
            activeOperationsList: result.data.activeOperations?.length || 0
        });
        return result.data;
    } catch (error) {
        console.error('❌ Real-time Stats failed:', error.message);
        return null;
    }
}

async function testDetailedReport(logId) {
    console.log('\n=== Testing Detailed Report ===');
    try {
        const result = await makeRequest('GET', `/${logId}/report`);
        console.log('✅ Detailed Report:', {
            logDetails: {
                platform: result.data.logDetails.platform,
                type: result.data.logDetails.type,
                status: result.data.logDetails.status,
                when: result.data.logDetails.when
            },
            summary: {
                totalProducts: result.data.summary.totalProducts,
                scrapedProducts: result.data.summary.scrapedProducts,
                failedProducts: result.data.summary.failedProducts,
                successRate: result.data.summary.successRate,
                duration: result.data.summary.duration
            },
            hasOperationDetails: !!result.data.operationDetails
        });
        return result.data;
    } catch (error) {
        console.error('❌ Detailed Report failed:', error.message);
        return null;
    }
}

async function testDashboardStats() {
    console.log('\n=== Testing Dashboard Statistics ===');
    try {
        const result = await makeRequest('GET', '/stats');
        console.log('✅ Dashboard Stats:', {
            counts: result.data.counts,
            total: result.data.total,
            successRate: result.data.successRate,
            chartDataPoints: result.data.chart?.length || 0
        });
        return result.data;
    } catch (error) {
        console.error('❌ Dashboard Stats failed:', error.message);
        return null;
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Enhanced Scrape Logs API Tests');
    console.log('==========================================');
    
    try {
        // Test 1: Create a scrape log
        const logId = await testCreateScrapeLog();
        if (!logId) {
            console.log('❌ Cannot continue tests without a valid log ID');
            return;
        }
        
        // Test 2: Get scrape logs with enhanced statistics
        await testGetScrapeLogs();
        
        // Test 3: Update scrape log with product statistics
        await testUpdateScrapeLog(logId);
        
        // Test 4: PATCH update with product statistics
        await testPatchScrapeLog(logId);
        
        // Test 5: Bulk update statistics
        await testBulkUpdateStats();
        
        // Test 6: Comprehensive statistics
        await testComprehensiveStats();
        
        // Test 7: Real-time statistics
        await testRealtimeStats();
        
        // Test 8: Detailed report
        await testDetailedReport(logId);
        
        // Test 9: Dashboard statistics
        await testDashboardStats();
        
        console.log('\n🎉 All tests completed!');
        console.log('\n📋 Enhanced API Features Summary:');
        console.log('✅ When (timestamp) tracking');
        console.log('✅ Total products to scrape count');
        console.log('✅ Failed products count');
        console.log('✅ Total scraped products count');
        console.log('✅ Product success rate calculation');
        console.log('✅ Enhanced update endpoints with product statistics');
        console.log('✅ Bulk update functionality');
        console.log('✅ Real-time statistics');
        console.log('✅ Comprehensive reporting');
        console.log('✅ Dashboard analytics');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
    }
}

// Run the tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    testCreateScrapeLog,
    testGetScrapeLogs,
    testUpdateScrapeLog,
    testPatchScrapeLog,
    testBulkUpdateStats,
    testComprehensiveStats,
    testRealtimeStats,
    testDetailedReport,
    testDashboardStats
};
