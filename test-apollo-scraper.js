const ApolloPharmacyScraper = require('./utilities/apollopharmacyScraper');
const fs = require('fs').promises;
const path = require('path');

async function testApolloScraper() {
    try {
        const scraper = new ApolloPharmacyScraper();
        const htmlContent = await fs.readFile(path.join(__dirname, 'scrapinghtml/apollopharmacy.html'), 'utf8');
        const result = await scraper.scrapeProduct(htmlContent);
        result.url = 'https://www.apollopharmacy.in/otc/gnc-fish-body-oil-1000mg-softgel-capsules-90-count';
        
        console.log('Apollo Pharmacy Scraper Test Results:');
        console.log('=====================================');
        console.log(JSON.stringify(result, null, 2));
        
        // Save test results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `apollo-test-${timestamp}.json`;
        await fs.writeFile(filename, JSON.stringify(result, null, 2));
        console.log(`\nTest results saved to: ${filename}`);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testApolloScraper();
