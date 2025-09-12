const cheerio = require('cheerio');

class BigBasketScraper {
    constructor() {
        this.source = 'BigBasket';
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return ((mrp - sellingPrice) / mrp) * 100;
        }
        return 0;
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const productData = {
                url: null, // To be filled if scraping from live URL
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: {}
            };

            // Extract data from JSON first (primary method)
            const jsonData = this.extractFromJSON($);
            if (jsonData) {
                this.processJSONData(jsonData, productData.product);
            }

            // Fallback to HTML extraction if JSON data is incomplete
            this.extractFromHTML($, productData.product);
            this.extractImages($, productData.product);
            this.extractProductInformation($, productData.product);

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    extractFromJSON($) {
        try {
            const scriptContent = $('script#__NEXT_DATA__').html();
            if (scriptContent) {
                const jsonData = JSON.parse(scriptContent);
                console.log('Successfully extracted JSON data from __NEXT_DATA__');
                return jsonData;
            }
            return null;
        } catch (error) {
            console.error('Error extracting JSON data:', error);
            return null;
        }
    }

    processJSONData(jsonData, htmlData) {
        try {
            const productDetails = jsonData.props?.pageProps?.productDetails;
            if (!productDetails) {
                console.log('No productDetails found in JSON data');
                return;
            }

            // Extract product information from children array
            if (productDetails.children && productDetails.children.length > 0) {
                const product = productDetails.children[0];
                
                // Product name and description
                if (product.desc) {
                    htmlData.title = product.desc;
                    console.log('Found product title from JSON:', product.desc);
                }

                // Brand information
                if (product.brand) {
                    htmlData.brand = product.brand;
                }

                // Weight/Pack size
                if (product.w) {
                    htmlData.packSize = product.w;
                    console.log('Found pack size from JSON:', product.w);
                }

                // Images
                if (product.images && product.images.length > 0) {
                    const images = product.images.map(img => {
                        // Use the largest available image
                        return img.xxl || img.xl || img.l || img.m || img.s;
                    }).filter(Boolean);
                    
                    htmlData.images = images;
                    console.log('Found images from JSON:', images.length);
                }

                // Pricing information
                if (product.pricing) {
                    const pricing = product.pricing;
                    if (pricing.mrp) {
                        htmlData.mrp = pricing.mrp;
                        console.log('Found MRP from JSON:', pricing.mrp);
                    }
                    if (pricing.price) {
                        htmlData.sellingPrice = pricing.price;
                        console.log('Found selling price from JSON:', pricing.price);
                    }
                    if (pricing.discount) {
                        htmlData.discount = pricing.discount;
                        console.log('Found discount from JSON:', pricing.discount);
                    }
                }

                // Package sizes/variants
                if (productDetails.children.length > 1) {
                    const packageSizes = productDetails.children.map(child => ({
                        id: child.id,
                        description: child.desc,
                        weight: child.w,
                        price: child.pricing?.price,
                        mrp: child.pricing?.mrp,
                        discount: child.pricing?.discount
                    }));
                    htmlData.packageSizes = packageSizes;
                    console.log('Found package sizes from JSON:', packageSizes.length);
                }

                // Additional information
                if (product.additional_info) {
                    const additionalInfo = product.additional_info;
                    if (additionalInfo.key_highlights && additionalInfo.key_highlights.length > 0) {
                        htmlData.highlights = additionalInfo.key_highlights;
                    }
                }

                // Product ID and URL
                if (product.id) {
                    htmlData.productId = product.id;
                }
                if (product.absolute_url) {
                    htmlData.productUrl = product.absolute_url;
                }
            }

        } catch (error) {
            console.error('Error processing JSON data:', error);
        }
    }

    extractFromHTML($, htmlData) {
        // Extract product name/title from HTML if not found in JSON
        if (!htmlData.title) {
            const titleElement = $('h1, .product-title, [data-testid="product-title"]');
            if (titleElement.length) {
                htmlData.title = titleElement.text().trim();
                console.log('Found product title from HTML:', htmlData.title);
            }
        }

        // Extract brand from HTML if not found in JSON
        if (!htmlData.brand) {
            const brandElement = $('.brand, [data-testid="brand"]');
            if (brandElement.length) {
                htmlData.brand = brandElement.text().trim();
                console.log('Found brand from HTML:', htmlData.brand);
            }
        }

        // Extract pricing from HTML if not found in JSON
        if (!htmlData.sellingPrice || !htmlData.mrp) {
            this.extractPricingFromHTML($, htmlData);
        }
    }

    extractPricingFromHTML($, htmlData) {
        let sellingPrice = null, mrp = null, discount = null;

        // Look for price elements
        $('.price, .selling-price, .offer-price').each((i, el) => {
            const text = $(el).text().trim();
            const priceMatch = text.match(/₹\s*(\d+)/);
            if (priceMatch) {
                const price = parseInt(priceMatch[1]);
                if (!sellingPrice) {
                    sellingPrice = price;
                }
            }
        });

        // Look for MRP elements
        $('.mrp, .original-price, .strikethrough').each((i, el) => {
            const text = $(el).text().trim();
            const priceMatch = text.match(/₹\s*(\d+)/);
            if (priceMatch) {
                const price = parseInt(priceMatch[1]);
                if (!mrp || price > mrp) {
                    mrp = price;
                }
            }
        });

        // Look for discount
        $('.discount, .off-percentage').each((i, el) => {
            const text = $(el).text().trim();
            const discountMatch = text.match(/(\d+)%/);
            if (discountMatch) {
                discount = parseInt(discountMatch[1]);
            }
        });

        // Set values if found
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (mrp) htmlData.mrp = mrp;
        if (discount) htmlData.discount = discount;

        // Calculate discount if both prices are available
        if (mrp && sellingPrice && !discount) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }

        console.log('Extracted pricing from HTML - MRP:', mrp, 'Selling Price:', sellingPrice, 'Discount:', discount);
    }

    extractImages($, htmlData) {
        // If images not found in JSON, extract from HTML
        if (!htmlData.images || htmlData.images.length === 0) {
            const imageUrls = [];
            
            $('img').each((i, el) => {
                const src = $(el).attr('src');
                const alt = $(el).attr('alt') || '';
                
                if (src && !imageUrls.includes(src)) {
                    // Filter for product images
                    if (src.includes('bbassets.com') || 
                        src.includes('product') ||
                        (src.includes('http') && 
                         !src.includes('logo') &&
                         !src.includes('icon') &&
                         !src.includes('banner'))) {
                        imageUrls.push(src);
                    }
                }
            });

            if (imageUrls.length > 0) {
                htmlData.images = imageUrls;
                console.log('Found images from HTML:', imageUrls.length);
            }
        }
    }

    extractProductInformation($, htmlData) {
        const information = {};

        // Extract product description
        const descriptionElement = $('.description, .product-description, [data-testid="description"]');
        if (descriptionElement.length) {
            information.description = descriptionElement.text().trim();
        }

        // Extract nutritional information
        const nutritionElement = $('.nutrition, .nutritional-info');
        if (nutritionElement.length) {
            information.nutritionalInfo = nutritionElement.text().trim();
        }

        // Extract storage instructions
        const storageElement = $('.storage, .storage-instructions');
        if (storageElement.length) {
            information.storageInstructions = storageElement.text().trim();
        }

        // Extract shelf life
        const shelfLifeElement = $('.shelf-life, .expiry');
        if (shelfLifeElement.length) {
            information.shelfLife = shelfLifeElement.text().trim();
        }

        // Extract country of origin
        const originElement = $('.origin, .country-of-origin');
        if (originElement.length) {
            information.countryOfOrigin = originElement.text().trim();
        }

        // Extract seller information
        const sellerElement = $('.seller, .vendor');
        if (sellerElement.length) {
            information.seller = sellerElement.text().trim();
        }

        // Extract delivery information
        const deliveryElement = $('.delivery, .delivery-info');
        if (deliveryElement.length) {
            information.deliveryInfo = deliveryElement.text().trim();
        }

        // Extract return policy
        const returnElement = $('.return-policy, .returns');
        if (returnElement.length) {
            information.returnPolicy = returnElement.text().trim();
        }

        // Extract from page text for additional information
        const pageText = $('body').text();
        
        // Look for weight information
        const weightMatch = pageText.match(/weight[:\s]*(\d+\s*[a-z]+)/i);
        if (weightMatch) {
            information.weight = weightMatch[1];
        }

        // Look for category information
        const categoryMatch = pageText.match(/category[:\s]*([^.\n]+)/i);
        if (categoryMatch) {
            information.category = categoryMatch[1].trim();
        }

        // Look for freshness guarantee
        const freshnessMatch = pageText.match(/freshness[:\s]*([^.\n]+)/i);
        if (freshnessMatch) {
            information.freshnessGuarantee = freshnessMatch[1].trim();
        }

        if (Object.keys(information).length > 0) {
            htmlData.information = information;
        }
    }
}

module.exports = BigBasketScraper;
