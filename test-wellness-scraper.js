const WellnessForeverScraper = require('./utilities/wellnessforeverScraper');
const fs = require('fs').promises;
const path = require('path');

async function testWellnessScraper() {
    try {
        const scraper = new WellnessForeverScraper();
        const htmlContent = await fs.readFile(path.join(__dirname, 'scrapinghtml/wellenessforever.html'), 'utf8');
        const result = await scraper.scrapeProduct(htmlContent);
        result.url = 'https://www.wellnessforever.com/product/pediasure-pwdr-vanila-box-950gm';
        
        console.log('Wellness Forever Scraper Test Results:');
        console.log('=====================================');
        console.log(JSON.stringify(result, null, 2));
        
        // Save test results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `wellness-test-${timestamp}.json`;
        await fs.writeFile(filename, JSON.stringify(result, null, 2));
        console.log(`\nTest results saved to: ${filename}`);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testWellnessScraper();