const AmazonCategoryScraper = require('./utilities/amazonCategoryScraper');

async function testAmazonCategoryScraper() {
  const scraper = new AmazonCategoryScraper();
  
  try {
    console.log('🚀 Starting Amazon Category Scraper Test...\n');
    
    // Test URL from the user's request
    const testUrl = 'https://www.amazon.in/s?k=today+offer&i=apparel&rh=n%3A1571271031%2Cp_72%3A1318476031%2Cp_n_pct-off-with-tax%3A27060456031&s=relevanceblender&dc&page=3&qid=1757739070&rnid=2665398031&xpid=7-7QQ4iHVorQD&ref=sr_pg_2';
    
    console.log('📋 Test URL:', testUrl);
    console.log('⏳ Scraping page 1...\n');
    
    // Test single page scraping
    const singlePageResult = await scraper.scrapeCategoryPage(testUrl, 1);
    
    console.log('✅ Single Page Results:');
    console.log(`   📄 Page: ${singlePageResult.page}`);
    console.log(`   🔗 URL: ${singlePageResult.url}`);
    console.log(`   📦 Total Products: ${singlePageResult.totalProducts}`);
    console.log(`   📊 Pagination Info:`, singlePageResult.pagination);
    
    if (singlePageResult.products.length > 0) {
      console.log('\n🛍️ Sample Product Data:');
      const sampleProduct = singlePageResult.products[0];
      console.log(`   🏷️  ASIN: ${sampleProduct.asin}`);
      console.log(`   📝 Name: ${sampleProduct.productName}`);
      console.log(`   🏢 Brand: ${sampleProduct.brand}`);
      console.log(`   💰 Selling Price: ₹${sampleProduct.sellingPrice}`);
      console.log(`   💸 MRP: ₹${sampleProduct.mrp}`);
      console.log(`   🎯 Discount: ${sampleProduct.discount}`);
      console.log(`   ⭐ Rating: ${sampleProduct.rating}`);
      console.log(`   📊 Reviews: ${sampleProduct.reviewCount}`);
      console.log(`   🖼️  Image: ${sampleProduct.productImage}`);
      console.log(`   🔗 URL: ${sampleProduct.productUrl}`);
      console.log(`   🎯 Sponsored: ${sampleProduct.isSponsored}`);
      console.log(`   🚚 Prime: ${sampleProduct.isPrime}`);
    }
    
    console.log('\n⏳ Testing specific pages [1, 2, 3]...\n');
    
    // Test specific pages scraping
    const specificPagesResult = await scraper.scrapeSpecificPages(testUrl, [1, 2, 3]);
    
    console.log('✅ Multiple Pages Results:');
    console.log(`   📄 Total Pages: ${multiPageResult.totalPages}`);
    console.log(`   ✅ Successful Pages: ${multiPageResult.successfulPages}`);
    console.log(`   ❌ Failed Pages: ${multiPageResult.failedPages}`);
    console.log(`   📦 Total Products: ${multiPageResult.allProducts.length}`);
    
    // Show summary by page
    multiPageResult.pageResults.forEach((pageResult, index) => {
      if (pageResult.error) {
        console.log(`   📄 Page ${pageResult.page}: ❌ Error - ${pageResult.error}`);
      } else {
        console.log(`   📄 Page ${pageResult.page}: ✅ ${pageResult.totalProducts} products`);
      }
    });
    
    // Show product statistics
    if (multiPageResult.allProducts.length > 0) {
      const products = multiPageResult.allProducts;
      const sponsoredCount = products.filter(p => p.isSponsored).length;
      const primeCount = products.filter(p => p.isPrime).length;
      const withDiscountCount = products.filter(p => p.discount).length;
      const withRatingCount = products.filter(p => p.rating).length;
      
      console.log('\n📊 Product Statistics:');
      console.log(`   🎯 Sponsored Products: ${sponsoredCount}`);
      console.log(`   🚚 Prime Products: ${primeCount}`);
      console.log(`   🎯 Products with Discount: ${withDiscountCount}`);
      console.log(`   ⭐ Products with Rating: ${withRatingCount}`);
      
      // Show price range
      const prices = products.filter(p => p.sellingPrice).map(p => parseFloat(p.sellingPrice));
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        console.log(`   💰 Price Range: ₹${minPrice} - ₹${maxPrice}`);
        console.log(`   💰 Average Price: ₹${avgPrice.toFixed(2)}`);
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await scraper.close();
    console.log('\n🔒 Browser closed.');
  }
}

// Run the test
if (require.main === module) {
  testAmazonCategoryScraper();
}

module.exports = testAmazonCategoryScraper;
