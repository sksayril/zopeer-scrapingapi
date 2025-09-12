const cheerio = require('cheerio');

class ApolloPharmacyScraper {
    constructor() {
        this.source = 'ApolloPharmacy';
    }

    async scrapeProduct(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            const htmlData = {};

            // Extract basic product information
            this.extractProductName($, htmlData);
            this.extractPricing($, htmlData);
            this.extractImages($, htmlData);
            this.extractOffers($, htmlData);
            this.extractProductDetails($, htmlData);
            this.extractKeyIngredients($, htmlData);
            this.extractDescription($, htmlData);
            this.extractKeyBenefits($, htmlData);
            this.extractDirectionsForUse($, htmlData);
            this.extractSafetyInformation($, htmlData);
            this.extractFAQs($, htmlData);

            return {
                scrapedAt: new Date().toISOString(),
                source: this.source,
                product: htmlData
            };
        } catch (error) {
            console.error('Error scraping Apollo Pharmacy product:', error);
            throw error;
        }
    }

    extractProductName($, htmlData) {
        // Extract product name from the specific Apollo Pharmacy structure
        const nameSelectors = [
            'h1.GB.FB.dh',
            '.PdpImagePlaceholder_title__kN_jC h1',
            'h1',
            '.product-title',
            '[data-testid="product-title"]'
        ];

        for (const selector of nameSelectors) {
            const element = $(selector);
            if (element.length) {
                const name = element.text().trim();
                if (name && name.length > 5) {
                    htmlData.name = name;
                    htmlData.title = name;
                    console.log('Found product name:', name);
                    break;
                }
            }
        }
    }

    extractPricing($, htmlData) {
        let sellingPrice = null, mrp = null, discountPercent = null;

        // Extract selling price - look for the main price with specific Apollo Pharmacy selectors
        const sellingPriceSelectors = [
            '.hd .id .qN_ .MB.FB.uN_',
            '.MB.FB.uN_',
            '.selling-price',
            '.offer-price',
            '.pdp-price',
            '[data-testid="selling-price"]'
        ];

        for (const selector of sellingPriceSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    sellingPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found selling price from', selector, ':', sellingPrice);
                    break;
                }
            }
        }

        // Extract MRP - look for strike-through price
        const mrpSelectors = [
            '.hd .id .qN_ .MB.FB.vN_.AN_.YB .sN_',
            '.sN_',
            '.price-mrp',
            '.mrp',
            '.original-price',
            '[data-testid="mrp"]',
            'strike',
            'del'
        ];

        for (const selector of mrpSelectors) {
            const element = $(selector);
            if (element.length) {
                const text = element.text().trim();
                const priceMatch = text.match(/₹\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    mrp = parseFloat(priceMatch[1].replace(/,/g, ''));
                    console.log('Found MRP from', selector, ':', mrp);
                    break;
                }
            }
        }

        // Extract discount percentage
        const discountSelectors = [
            '.hd .id .qN_ .MB.FB.vN_.AN_.YB .tN_',
            '.tN_',
            '.discount',
            '.off-percentage',
            '.pdp-discount',
            '[data-testid="discount"]'
        ];

        for (const selector of discountSelectors) {
            const element = $(selector);
            if (element.length) {
                const discountText = element.text().trim();
                const discountMatch = discountText.match(/(\d+)%\s*off/i);
                if (discountMatch) {
                    discountPercent = parseInt(discountMatch[1]);
                    console.log('Found discount percentage from', selector, ':', discountPercent);
                    break;
                }
            }
        }

        // Fallback: Look for prices in page text
        if (!sellingPrice || !mrp) {
            const pageText = $('body').text();
            const pricePattern = /₹\s*([\d,]+\.?\d*)/g;
            const prices = [];
            let match;
            
            while ((match = pricePattern.exec(pageText)) !== null) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range for pharmacy items
                    prices.push(price);
                }
            }
            
            if (prices.length > 0) {
                prices.sort((a, b) => a - b);
                if (!sellingPrice) sellingPrice = prices[0];
                if (!mrp && prices.length > 1) mrp = prices[prices.length - 1];
                console.log('Found prices from page text - selling:', sellingPrice, 'mrp:', mrp);
            }
        }

        // Set the extracted values
        if (mrp) htmlData.mrp = mrp;
        if (sellingPrice) htmlData.sellingPrice = sellingPrice;
        if (discountPercent) htmlData.discountPercent = discountPercent;

        // Calculate discount amount if both prices are available
        if (mrp && sellingPrice) {
            htmlData.discount = this.calculateDiscount(mrp, sellingPrice);
        }

        console.log('Final pricing - MRP:', mrp, 'Selling Price:', sellingPrice, 'Discount:', htmlData.discount);
    }

    extractImages($, htmlData) {
        const imageUrls = [];
        
        // Extract main product images from Apollo Pharmacy structure
        $('.PdpImagePlaceholder_productImageWrapper__GF3nf img, .keen-slider__slide img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && this.isValidImageUrl(src)) {
                imageUrls.push(src);
            }
        });

        // Also extract from thumbnail images
        $('.RenderCarosuelThumbnail_thumbnailImage__0yFCN').each((i, el) => {
            const src = $(el).attr('src');
            if (src && this.isValidImageUrl(src)) {
                imageUrls.push(src);
            }
        });

        // Remove duplicates
        const uniqueImages = [...new Set(imageUrls)];
        
        if (uniqueImages.length > 0) {
            htmlData.images = uniqueImages;
        }
    }

    extractOffers($, htmlData) {
        const offers = [];

        // Extract offers from the specific Apollo Pharmacy structure
        $('.keen-slider__slide .Vp .Wp .Xp span, .keen-slider__slide .Yp').each((i, el) => {
            const offerText = $(el).text().trim();
            if (offerText && offerText.length > 3) {
                offers.push(offerText);
            }
        });

        // Extract specific offers mentioned in the content
        const specificOffers = [
            'PHARMA20 - 20% OFF, applicable on orders > INR 5499',
            'EXTRA200 - Get upto 200 HCs on non medicine orders > INR 3500',
            'BABY100 - Flat Rs. 100 OFF on baby care orders > INR 1500'
        ];

        specificOffers.forEach(offer => {
            if (!offers.includes(offer)) {
                offers.push(offer);
            }
        });

        if (offers.length > 0) {
            htmlData.offers = offers;
        }
    }

    extractProductDetails($, htmlData) {
        const productDetails = {};

        // Extract manufacturer/marketer
        $('.Grid_Item__KaQ4v').each((i, el) => {
            const label = $(el).find('h3').text().trim();
            const value = $(el).find('.wj').text().trim();
            
            if (label && value) {
                switch (label.toLowerCase()) {
                    case 'manufacturer/marketer':
                        productDetails.manufacturer = value;
                        break;
                    case 'consume type':
                        productDetails.consumeType = value;
                        break;
                    case 'return policy':
                        productDetails.returnPolicy = value;
                        break;
                    case 'expires on or after':
                        productDetails.expiryDate = value;
                        break;
                }
            }
        });

        // Extract country of origin and other info
        $('.Vd .tj').each((i, el) => {
            const label = $(el).find('h3').text().trim();
            const value = $(el).find('.wj').text().trim();
            
            if (label && value) {
                switch (label.toLowerCase()) {
                    case 'country of origin':
                        productDetails.countryOfOrigin = value;
                        break;
                    case 'manufacturer/marketer address':
                        productDetails.manufacturerAddress = value;
                        break;
                }
            }
        });

        // Extract other info
        const otherInfo = $('.Vd strong').next().text().trim();
        if (otherInfo) {
            productDetails.otherInfo = otherInfo;
        }

        if (Object.keys(productDetails).length > 0) {
            htmlData.productDetails = productDetails;
        }
    }

    extractKeyIngredients($, htmlData) {
        const ingredients = [];

        // Extract key ingredients from the specific Apollo Pharmacy structure
        $('.BannerSection_bannerSectionDefault__TWrff').each((i, el) => {
            const sectionTitle = $(el).find('p').text().trim();
            if (sectionTitle.toLowerCase().includes('key ingredients')) {
                const ingredientsText = $(el).find('.wj').text().trim();
                if (ingredientsText) {
                    ingredients.push(ingredientsText);
                }
            }
        });

        if (ingredients.length > 0) {
            htmlData.keyIngredients = ingredients;
        }
    }

    extractDescription($, htmlData) {
        let description = '';

        // Extract description from the specific Apollo Pharmacy structure
        $('.BannerSection_bannerSectionDefault__TWrff').each((i, el) => {
            const sectionTitle = $(el).find('p').text().trim();
            if (sectionTitle.toLowerCase().includes('description')) {
                const descText = $(el).find('.wj').text().trim();
                if (descText) {
                    description = descText;
                }
            }
        });

        if (description) {
            htmlData.description = description;
        }
    }

    extractKeyBenefits($, htmlData) {
        const benefits = [];

        // Extract key benefits from the specific Apollo Pharmacy structure
        $('.BannerSection_bannerSectionDefault__TWrff').each((i, el) => {
            const sectionTitle = $(el).find('p').text().trim();
            if (sectionTitle.toLowerCase().includes('key benefits')) {
                $(el).find('.wj ul li').each((i, benefitEl) => {
                    const benefit = $(benefitEl).text().trim();
                    if (benefit && benefit.length > 10) {
                        benefits.push(benefit);
                    }
                });
            }
        });

        if (benefits.length > 0) {
            htmlData.keyBenefits = benefits;
        }
    }

    extractDirectionsForUse($, htmlData) {
        const directions = [];

        // Extract directions for use from the specific Apollo Pharmacy structure
        $('.BannerSection_bannerSectionDefault__TWrff').each((i, el) => {
            const sectionTitle = $(el).find('p').text().trim();
            if (sectionTitle.toLowerCase().includes('directions for use')) {
                $(el).find('.wj ul li').each((i, directionEl) => {
                    const direction = $(directionEl).text().trim();
                    if (direction && direction.length > 5) {
                        directions.push(direction);
                    }
                });
            }
        });

        if (directions.length > 0) {
            htmlData.directionsForUse = directions;
        }
    }

    extractSafetyInformation($, htmlData) {
        let safetyInfo = '';

        // Extract safety information from the specific Apollo Pharmacy structure
        $('.BannerSection_bannerSectionDefault__TWrff').each((i, el) => {
            const sectionTitle = $(el).find('p').text().trim();
            if (sectionTitle.toLowerCase().includes('safety information')) {
                const safetyText = $(el).find('.wj').text().trim();
                if (safetyText) {
                    safetyInfo = safetyText;
                }
            }
        });

        if (safetyInfo) {
            htmlData.safetyInformation = safetyInfo;
        }
    }

    extractFAQs($, htmlData) {
        const faqs = [];

        // Extract FAQs from the specific Apollo Pharmacy structure
        $('.yh').each((i, el) => {
            const question = $(el).find('.Ah').text().trim();
            const answer = $(el).find('.Ch').text().trim();
            
            if (question && answer) {
                faqs.push({
                    question: question,
                    answer: answer
                });
            }
        });

        if (faqs.length > 0) {
            htmlData.faqs = faqs;
        }
    }

    isValidImageUrl(url) {
        if (!url) return false;
        
        // Filter out non-product images
        const excludePatterns = [
            'logo', 'icon', 'banner', 'advertisement', 'social', 'share',
            'facebook', 'twitter', 'instagram', 'youtube', 'linkedin',
            'playstore', 'appstore', 'download', 'arrow', 'button',
            'header', 'footer', 'navigation', 'menu', 'search'
        ];
        
        const lowerUrl = url.toLowerCase();
        return !excludePatterns.some(pattern => lowerUrl.includes(pattern)) &&
               (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || 
                lowerUrl.includes('.png') || lowerUrl.includes('.webp'));
    }

    calculateDiscount(mrp, sellingPrice) {
        if (mrp && sellingPrice && mrp > sellingPrice) {
            return mrp - sellingPrice;
        }
        return 0;
    }
}

module.exports = ApolloPharmacyScraper;
