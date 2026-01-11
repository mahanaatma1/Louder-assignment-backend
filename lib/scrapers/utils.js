// Scraper utility functions

// clean and normalize text
export const cleanText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.replace(/\s+/g, ' ').trim();
};

// parse date string to Date object
export const parseDate = (dateStr) => {
  if (!dateStr) {
    return new Date();
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  } catch (error) {
    return new Date();
  }
};

// normalize URL - make absolute URL from relative
export const normalizeUrl = (url, baseUrl) => {
  if (!url) {
    return '';
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return url;
  }
};

// extract text from element
export const extractText = ($, element, selector) => {
  const found = element.find(selector).first();
  return cleanText(found.text());
};

// extract attribute from element
export const extractAttribute = (element, attribute, selector = null) => {
  const target = selector ? element.find(selector).first() : element;
  return target.attr(attribute) || '';
};

// remove duplicates from array based on key
export const removeDuplicates = (array, keyFn) => {
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

