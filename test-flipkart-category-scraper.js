const FlipkartCategoryScraper = require('./utilities/flipkartCategoryScraper');

async function testFlipkartCategoryScraper() {
  const scraper = new FlipkartCategoryScraper();
  
  try {
    console.log('🚀 Starting Flipkart Category Scraper Test...\n');
    
    // Test URL from the user's request
    const testUrl = 'https://www.flipkart.com/all/pr?sid=all&sort=popularity&p%5B%5D=facets.discount_range_v1%255B%255D%3D50%2525%2Bor%2Bmore&p%5B%5D=facets.availability%255B%255D%3DExclude%2BOut%2Bof%2BStock&p%5B%5D=facets.rating%255B%255D%3D4%25E2%2598%2585%2B%2526%2Babove&page=2';
    
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
      console.log(`   🆔 Product ID: ${sampleProduct.productId}`);
      console.log(`   📝 Name: ${sampleProduct.productName}`);
      console.log(`   🏢 Brand: ${sampleProduct.brand}`);
      console.log(`   💰 Selling Price: ₹${sampleProduct.sellingPrice}`);
      console.log(`   💸 Actual Price: ₹${sampleProduct.actualPrice}`);
      console.log(`   🎯 Discount: ${sampleProduct.discount}`);
      console.log(`   ⭐ Rating: ${sampleProduct.rating}`);
      console.log(`   📊 Reviews: ${sampleProduct.reviewCount}`);
      console.log(`   🖼️  Image: ${sampleProduct.productImage}`);
      console.log(`   🔗 URL: ${sampleProduct.productUrl}`);
      console.log(`   📦 Availability: ${sampleProduct.availability}`);
      console.log(`   ❤️  Wishlisted: ${sampleProduct.isWishlisted}`);
    }
    
    console.log('\n⏳ Testing specific pages [1, 2]...\n');
    
    // Test specific pages scraping
    const specificPagesResult = await scraper.scrapeSpecificPages(testUrl, [1, 2]);
    
    console.log('✅ Multiple Pages Results:');
    console.log(`   📄 Total Pages: ${specificPagesResult.totalPages}`);
    console.log(`   ✅ Successful Pages: ${specificPagesResult.successfulPages}`);
    console.log(`   ❌ Failed Pages: ${specificPagesResult.failedPages}`);
    console.log(`   📦 Total Products: ${specificPagesResult.allProducts.length}`);
    
    // Show summary by page
    specificPagesResult.pageResults.forEach((pageResult, index) => {
      if (pageResult.error) {
        console.log(`   📄 Page ${pageResult.page}: ❌ Error - ${pageResult.error}`);
      } else {
        console.log(`   📄 Page ${pageResult.page}: ✅ ${pageResult.totalProducts} products`);
      }
    });
    
    // Show product statistics
    if (specificPagesResult.allProducts.length > 0) {
      const products = specificPagesResult.allProducts;
      const wishlistedCount = products.filter(p => p.isWishlisted).length;
      const withDiscountCount = products.filter(p => p.discount).length;
      const withRatingCount = products.filter(p => p.rating).length;
      const inStockCount = products.filter(p => p.availability === 'In Stock').length;
      
      console.log('\n📊 Product Statistics:');
      console.log(`   ❤️  Wishlisted Products: ${wishlistedCount}`);
      console.log(`   🎯 Products with Discount: ${withDiscountCount}`);
      console.log(`   ⭐ Products with Rating: ${withRatingCount}`);
      console.log(`   📦 In Stock Products: ${inStockCount}`);
      
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
  testFlipkartCategoryScraper();
}

module.exports = testFlipkartCategoryScraper;
