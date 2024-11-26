// utils/queryParser.js
class QueryParser {
  constructor(req) {
    this.query = this.parseRequest(req);
  }

  parseRequest(req) {
    return {
      pagination: this.parsePagination(req),
      sort: this.parseSort(req),
      filters: this.parseFilters(req),
      options: this.parseOptions(req),
    };
  }

  parsePagination(req) {
    const { page = 1, per_page = 10 } = req.query;
    return {
      page: parseInt(page),
      perPage: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    };
  }

  parseSort(req) {
    const { sort } = req.query;
    if (!sort) return { field: 'createdAt', direction: 'desc' };

    return {
      field: sort.startsWith('-') ? sort.slice(1) : sort,
      direction: sort.startsWith('-') ? 'desc' : 'asc',
    };
  }

  parseFilters(req) {
    const filters = {};
    const { date_field, start_date, end_date, ...otherFilters } = req.query;

    // Handle date range
    if (start_date || end_date) {
      filters.dateRange = {
        dateField: date_field,
        startDate: start_date,
        endDate: end_date,
      };
    }

    // Handle other filters
    Object.entries(otherFilters).forEach(([key, value]) => {
      // Skip pagination and sorting params
      if (!['page', 'per_page', 'sort'].includes(key)) {
        filters[key] = value;
      }
    });

    return filters;
  }

  parseOptions(req) {
    // Add any special options parsing here
    return {};
  }

  getQuery() {
    return this.query;
  }
}

module.exports = QueryParser;
